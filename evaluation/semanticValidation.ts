import {
  CALIBRATION_VERSION,
  INVENTORY_SCHEMA_VERSION,
  RULE_APPLICABILITY_VERSION,
  type RuleAssessment,
  type SemanticConfidence,
  type SemanticExtractorManifest,
  type SemanticVideoInventory,
  type SemanticObservation,
} from './contracts';
import { isTargetNiche } from './niches';
import { RULE_FAMILIES } from './sourceRules';
import { contextualInventoryId } from './semanticIds';

export type SemanticReferenceIndex = {
  fingerprint: string;
  durationSeconds: number;
  evidenceIds: Set<string>;
  frameIds: Set<string>;
  shotIds: Set<string>;
  frameTimes: Map<string, number>;
  shotIntervals: Map<string, { startSec: number; endSec: number }>;
  evidenceIntervals: Map<string, { startSec: number; endSec: number }>;
  evidenceProvenance: Map<string, Exclude<SemanticObservation['provenance'], 'user_context'>>;
  evidenceConfidence: Map<string, 'high' | 'medium' | 'low'>;
};

const forbiddenScoringKeys = new Set(['star', 'stars', 'starrating', 'rating', 'ratings', 'overallrating', 'overallstars', 'overallscore', 'overallscorepercent', 'overallpercent', 'aspectscore', 'aspectscores', 'score', 'scores', 'scoreeffect', 'scorededuction', 'deduction', 'deductions', 'cap', 'caps', 'weight', 'weights', 'point', 'points', 'penalty', 'penalties', 'numericalscore', 'skipestimate', 'appliedrule', 'appliedrules', 'conversionindex', 'shareabilityindex', 'nonfollowerintereststars', 'verdict']);

function assertNoScoringFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(assertNoScoringFields); return; }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenScoringKeys.has(key.replace(/[_-]/g, '').toLowerCase())) throw new Error('Phase 3 semantic payloads cannot contain numerical scoring fields.');
    assertNoScoringFields(child);
  }
}

function uniqueKnown(values: string[], known: Set<string>, label: string, required = false): void {
  if (required && !values.length) throw new Error(`${label} are required.`);
  if (new Set(values).size !== values.length || values.some(value => !known.has(value))) throw new Error(`${label} contain missing or duplicate references.`);
}

function validateConfidence(confidence: SemanticConfidence): void {
  if (!confidence || !Number.isFinite(confidence.value) || confidence.value < 0 || confidence.value > 1) throw new Error('Semantic confidence must be between zero and one.');
  if (!['high', 'medium', 'low'].includes(confidence.level) || confidence.calibrationVersion !== CALIBRATION_VERSION) throw new Error('Semantic confidence uses an unsupported calibration boundary.');
}

function validateInterval(interval: { startSec: number; endSec: number }, durationSeconds: number): void {
  if (!interval || !Number.isFinite(interval.startSec) || !Number.isFinite(interval.endSec) || interval.startSec < 0 || interval.endSec < interval.startSec || interval.endSec > durationSeconds) throw new Error('Semantic interval is outside the Reel.');
}

function validateSemanticId(kind: 'observation' | 'inventory' | 'applicability', id: string, fingerprint: string, interval?: { startSec: number; endSec: number } | null): void {
  const prefix = { observation: 'SEMANTIC_OBSERVATION', inventory: 'SEMANTIC_INVENTORY', applicability: 'RULE_ASSESSMENT' }[kind];
  const match = id.match(new RegExp(`^${prefix}_[0-9]{4}_([0-9]{6})_([0-9]{6})_([a-f0-9]{64})$`));
  if (!match || match[3] !== fingerprint.slice(7)) throw new Error(`Invalid ${kind} ID for this upload.`);
  if (interval && (Number(match[1]) !== Math.round(interval.startSec * 1000) || Number(match[2]) !== Math.round(interval.endSec * 1000))) throw new Error(`The ${kind} ID does not match its interval.`);
}

export function validateSemanticObservation(observation: SemanticObservation, references: SemanticReferenceIndex, extractors: SemanticExtractorManifest[] = []): void {
  assertNoScoringFields(observation);
  if (!observation?.id || !observation.kind || !['observed', 'not_observed', 'unknown', 'not_applicable'].includes(observation.state)) throw new Error('Invalid semantic observation identity or state.');
  validateSemanticId('observation', observation.id, references.fingerprint, observation.interval);
  validateConfidence(observation.confidence);
  if (observation.interval) validateInterval(observation.interval, references.durationSeconds);
  const grounded = observation.state !== 'unknown';
  uniqueKnown(observation.evidenceIds, references.evidenceIds, 'Semantic evidence IDs', grounded);
  uniqueKnown(observation.frameIds, references.frameIds, 'Semantic frame IDs', grounded);
  uniqueKnown(observation.shotIds, references.shotIds, 'Semantic shot IDs', grounded);
  if (grounded && !observation.interval) throw new Error('Grounded semantic observations require a timestamp interval.');
  if (observation.interval) {
    if (observation.evidenceIds.some(id => { const interval = references.evidenceIntervals.get(id); return !interval || interval.endSec < observation.interval!.startSec || interval.startSec > observation.interval!.endSec; })) throw new Error('Semantic evidence references must overlap the observation interval.');
    if (observation.frameIds.some(id => { const time = references.frameTimes.get(id); return time === undefined || time < observation.interval!.startSec || time > observation.interval!.endSec; })) throw new Error('Semantic frame references must fall inside the observation interval.');
    if (observation.shotIds.some(id => { const shot = references.shotIntervals.get(id); return !shot || shot.endSec < observation.interval!.startSec || shot.startSec > observation.interval!.endSec; })) throw new Error('Semantic shot references must overlap the observation interval.');
  }
  if (observation.state === 'observed' && observation.value === null) throw new Error('Observed semantic claims require a value.');
  if (observation.state !== 'observed' && observation.value !== null) throw new Error('Only observed semantic claims may carry a value.');
  if (observation.state === 'unknown' && !observation.uncertaintyReasons.length) throw new Error('Unknown semantic claims require uncertainty reasons.');
  if (!observation.extractor?.id || !observation.extractor.version || !observation.extractor.runtime || !['webgpu', 'wasm', 'none'].includes(observation.extractor.executionProvider)) throw new Error('Semantic extractor provenance is incomplete.');
  if (grounded && observation.extractor.executionProvider === 'none') throw new Error('Grounded semantic observations require an extractor that actually executed.');
  if (grounded) {
    const extractor = extractors.find(item => item.id === observation.extractor.id && item.version === observation.extractor.version);
    if (!extractor || extractor.state !== 'available' || extractor.executionProvider !== observation.extractor.executionProvider || extractor.runtime !== observation.extractor.runtime || extractor.runtimeRevision !== observation.extractor.runtimeRevision) throw new Error('Grounded semantic observations require a matching available extractor manifest.');
  }
  if (observation.extractor.modelId && !observation.extractor.modelRevision) throw new Error('Semantic models require an immutable revision.');
  if (!['measured_local', 'ocr_local', 'transcript_local', 'semantic_local', 'user_context'].includes(observation.provenance)) throw new Error('Remote provenance is not allowed in the normal local semantic contract.');
}

export function validateSemanticInventory(inventory: SemanticVideoInventory, references: SemanticReferenceIndex): void {
  assertNoScoringFields(inventory);
  if (inventory.version !== INVENTORY_SCHEMA_VERSION || inventory.factual.version !== INVENTORY_SCHEMA_VERSION) throw new Error('Unsupported semantic inventory version.');
  if (inventory.fingerprint !== references.fingerprint || inventory.factual.fingerprint !== references.fingerprint) throw new Error('Semantic inventory fingerprint does not match the upload.');
  if (inventory.durationSeconds !== references.durationSeconds || inventory.factual.durationSeconds !== references.durationSeconds) throw new Error('Semantic inventory duration does not match the upload.');
  if (!isTargetNiche(inventory.selectedTargetNiche) || inventory.factualInventoryId !== inventory.factual.id) throw new Error('Invalid semantic inventory identity or Target Niche.');
  validateSemanticId('inventory', inventory.factual.id, references.fingerprint, { startSec: 0, endSec: references.durationSeconds });
  if (inventory.inventoryId !== contextualInventoryId(inventory.factual.id, inventory.selectedTargetNiche)) throw new Error('Contextual inventory identity must bind the factual inventory to the exact Target Niche.');
  if (!['high', 'medium', 'low'].includes(inventory.capabilityTier)) throw new Error('Invalid semantic capability tier.');
  const qualification = inventory.capabilityQualification;
  if (!qualification || qualification.version !== 'semantic-runtime-capabilities-v1' || qualification.tier !== inventory.capabilityTier) throw new Error('Semantic capability tier must match its runtime qualification.');
  if (!['available', 'unavailable', 'unknown'].includes(qualification.webgpu?.state) || !['available', 'unavailable', 'unknown'].includes(qualification.wasm?.state) || typeof qualification.wasm?.simd !== 'boolean' || !['available', 'unavailable', 'unknown'].includes(qualification.worker?.state) || typeof qualification.constrained !== 'boolean') throw new Error('Semantic runtime qualification is invalid.');
  const profile = qualification.warmupProfile;
  if (profile && (!profile.id || !profile.revision || !/^sha256-[a-f0-9]{64}$/.test(profile.checksum) || !Number.isInteger(profile.assetBytes) || profile.assetBytes < 1 || !Number.isInteger(profile.peakBytes) || profile.peakBytes < 1 || !Number.isInteger(profile.largestBufferBytes) || profile.largestBufferBytes < 1 || profile.largestBufferBytes > profile.peakBytes || !profile.providers.length || profile.providers.some(provider => !['webgpu', 'wasm'].includes(provider)) || new Set(profile.providers).size !== profile.providers.length)) throw new Error('Semantic runtime warm-up profile is invalid.');
  const highQualified = qualification.worker.state === 'available' && qualification.wasm.state === 'available' && qualification.webgpu.state === 'available' && !qualification.constrained && !!profile?.providers.includes('webgpu') && !!profile.providers.includes('wasm') && profile.peakBytes >= 512 * 1024 * 1024;
  const mediumQualified = qualification.worker.state === 'available' && qualification.wasm.state === 'available' && qualification.wasm.simd && !qualification.constrained && !!profile?.providers.includes('wasm') && profile.peakBytes >= 128 * 1024 * 1024;
  const qualifiedTier = highQualified ? 'high' : mediumQualified ? 'medium' : 'low';
  if (inventory.capabilityTier !== qualifiedTier) throw new Error('Semantic capability tier is not supported by the verified runtime warm-up.');
  validateConfidence(inventory.factual.confidence);
  const observationIds = new Set(inventory.observations.map(row => row.id));
  if (observationIds.size !== inventory.observations.length) throw new Error('Semantic observation IDs must be unique.');
  inventory.observations.forEach(row => validateSemanticObservation(row, references, inventory.extractors));
  uniqueKnown(inventory.factual.observationIds, observationIds, 'Factual observation IDs');
  uniqueKnown(inventory.contextualObservationIds, observationIds, 'Contextual observation IDs');
  if (inventory.contextualObservationIds.some(id => inventory.factual.observationIds.includes(id))) throw new Error('Target Niche context cannot enter the factual observation graph.');
  if (inventory.factual.observationIds.length + inventory.contextualObservationIds.length !== observationIds.size) throw new Error('Every semantic observation must belong to exactly one factual or contextual partition.');
  if (inventory.observations.some(row => inventory.factual.observationIds.includes(row.id) && row.provenance === 'user_context')) throw new Error('User context cannot enter the factual observation graph.');
  if (inventory.observations.some(row => inventory.contextualObservationIds.includes(row.id) && row.provenance !== 'user_context')) throw new Error('Contextual observations must be explicitly identified as user context.');
  const factualObservationIds = new Set(inventory.factual.observationIds);
  for (const [key, value] of Object.entries(inventory.factual)) if (key.endsWith('ObservationIds') && Array.isArray(value)) uniqueKnown(value as string[], factualObservationIds, key);
  for (const frame of inventory.factual.representativeFrames) {
    uniqueKnown([frame.frameId], references.frameIds, 'Representative frame IDs', true);
    uniqueKnown(frame.sourceEvidenceIds, references.evidenceIds, 'Representative source evidence IDs', true);
    if (!Number.isFinite(frame.timeSec) || frame.timeSec < 0 || frame.timeSec > references.durationSeconds || references.frameTimes.get(frame.frameId) !== frame.timeSec || !frame.selectionReasons.length) throw new Error('Representative frames require valid time and selection reasons.');
  }
  for (const shot of inventory.factual.shots) {
    uniqueKnown([shot.shotId], references.shotIds, 'Inventory shot IDs', true);
    uniqueKnown(shot.representativeFrameIds, references.frameIds, 'Shot representative frame IDs', true);
    uniqueKnown(shot.observationIds, factualObservationIds, 'Shot observation IDs');
    const referenceShot = references.shotIntervals.get(shot.shotId);
    if (shot.startSec < 0 || shot.endSec <= shot.startSec || shot.endSec > references.durationSeconds || !referenceShot || shot.startSec !== referenceShot.startSec || shot.endSec !== referenceShot.endSec) throw new Error('Inventory shot interval is invalid.');
    if (shot.representativeFrameIds.some(id => { const time = references.frameTimes.get(id); return time === undefined || time < shot.startSec || time > shot.endSec; })) throw new Error('Shot representative frames must fall inside the shot interval.');
  }
  if (new Set(inventory.extractors.map(item => item.id)).size !== inventory.extractors.length || new Set(inventory.models.map(item => `${item.id}@${item.revision}`)).size !== inventory.models.length) throw new Error('Extractor and model manifests must be unique.');
  for (const extractor of inventory.extractors) if (!extractor.id || !extractor.version || !extractor.purpose || !extractor.runtime || !['available', 'unavailable', 'failed'].includes(extractor.state) || !['webgpu', 'wasm', 'none'].includes(extractor.executionProvider) || !Array.isArray(extractor.limitations)) throw new Error('Semantic extractor manifest is invalid.');
  for (const model of inventory.models) if (!model.id || !model.revision || !model.license || !/^sha256-[a-f0-9]{64}$/.test(model.checksum) || !['webgpu', 'wasm'].includes(model.executionProvider) || !Number.isInteger(model.assetBytes) || model.assetBytes < 1 || typeof model.cached !== 'boolean') throw new Error('Semantic model manifest is invalid.');
  for (const observation of inventory.observations) {
    const extractor = inventory.extractors.find(item => item.id === observation.extractor.id && item.version === observation.extractor.version);
    if (!extractor || extractor.executionProvider !== observation.extractor.executionProvider || extractor.runtime !== observation.extractor.runtime || extractor.runtimeRevision !== observation.extractor.runtimeRevision) throw new Error('Semantic observation extractor is absent from its manifest.');
    if (observation.state !== 'unknown' && (extractor.state !== 'available' || observation.extractor.executionProvider === 'none')) throw new Error('Grounded semantic observations require an available extractor that actually executed.');
    if (observation.state !== 'unknown' && !profile?.providers.includes(observation.extractor.executionProvider as 'webgpu' | 'wasm')) throw new Error('Grounded semantic observations require a verified runtime provider warm-up.');
    if (observation.extractor.modelId) {
      const model = inventory.models.find(item => item.id === observation.extractor.modelId && item.revision === observation.extractor.modelRevision);
      if (!model || model.executionProvider !== observation.extractor.executionProvider || model.quantization !== observation.extractor.quantization) throw new Error('Semantic observation model is absent from its manifest.');
      if (observation.state !== 'unknown' && (!profile || model.id !== profile.id || model.revision !== profile.revision || model.checksum !== profile.checksum || model.assetBytes !== profile.assetBytes || !profile.providers.includes(model.executionProvider))) throw new Error('Grounded semantic model observations require the exact allocation-qualified model artifact.');
    }
  }
  for (const id of inventory.factual.unknownObservationIds) if (inventory.observations.find(row => row.id === id)?.state !== 'unknown') throw new Error('Unknown inventory references must identify unknown observations.');
}

export function validateRuleAssessment(assessment: RuleAssessment, references: SemanticReferenceIndex, observations: SemanticObservation[], extractors: SemanticExtractorManifest[]): void {
  assertNoScoringFields(assessment);
  if (!assessment?.id || assessment.version !== RULE_APPLICABILITY_VERSION || !assessment.ruleId || !assessment.reason) throw new Error('Invalid rule assessment identity or version.');
  validateInterval(assessment.interval, references.durationSeconds);
  validateSemanticId('applicability', assessment.id, references.fingerprint, assessment.interval);
  validateConfidence(assessment.confidence);
  uniqueKnown(assessment.evidenceIds, references.evidenceIds, 'Rule evidence IDs');
  const observationById = new Map(observations.map(observation => [observation.id, observation]));
  if (observationById.size !== observations.length) throw new Error('Rule semantic observations must have unique IDs.');
  observations.forEach(observation => validateSemanticObservation(observation, references, extractors));
  uniqueKnown(assessment.semanticObservationIds, new Set(observationById.keys()), 'Rule semantic observation IDs');
  if (!['applicable', 'not_applicable', 'unknown'].includes(assessment.applicability) || !['supports_principle', 'concern_observed', 'mixed', 'not_applicable', 'unknown'].includes(assessment.outcome)) throw new Error('Invalid applicability or qualitative outcome.');
  if (assessment.applicability === 'unknown' && assessment.outcome !== 'unknown') throw new Error('Unknown applicability requires an unknown outcome.');
  if (assessment.applicability === 'not_applicable' && assessment.outcome !== 'not_applicable') throw new Error('Not-applicable rules require a not-applicable outcome.');
  if (assessment.applicability === 'applicable' && ['unknown', 'not_applicable'].includes(assessment.outcome)) throw new Error('Applicable rules require an assessed qualitative outcome.');
  if (assessment.applicability === 'unknown' && !assessment.missingEvidence.length && !assessment.conflictingEvidence.length) throw new Error('Unknown applicability requires missing or conflicting evidence.');
  if (assessment.applicability !== 'unknown' && (!assessment.evidenceIds.length || !assessment.semanticObservationIds.length)) throw new Error('Applicable and not-applicable decisions require positive evidence.');
  if (!assessment.sourceReferences.length || assessment.sourceReferences.some(source => !source.document || !source.pages.length || source.pages.some(page => !Number.isInteger(page) || page < 1))) throw new Error('Rule assessments require page-level source references.');
  const definition = Object.values(RULE_FAMILIES).find(rule => rule.ruleId === assessment.ruleId);
  if (!definition || JSON.stringify(assessment.requiredEvidence) !== JSON.stringify(definition.requiredEvidence) || JSON.stringify(assessment.sourceReferences) !== JSON.stringify(definition.sources)) throw new Error('Rule assessment does not match the source-derived registry.');
  if (!Array.isArray(assessment.requirementBindings) || assessment.requirementBindings.length !== definition.requiredEvidence.length || new Set(assessment.requirementBindings.map(binding => binding.requirement)).size !== definition.requiredEvidence.length || definition.requiredEvidence.some(requirement => !assessment.requirementBindings.some(binding => binding.requirement === requirement))) throw new Error('Every required evidence item needs exactly one requirement binding.');
  const boundEvidenceIds = new Set<string>(); const boundObservationIds = new Set<string>();
  for (const binding of assessment.requirementBindings) {
    if (!['satisfied', 'missing', 'conflicting'].includes(binding.state)) throw new Error('Rule requirement binding state is invalid.');
    uniqueKnown(binding.evidenceIds, references.evidenceIds, 'Bound rule evidence IDs');
    uniqueKnown(binding.semanticObservationIds, new Set(observationById.keys()), 'Bound semantic observation IDs');
    if (binding.state === 'missing' && (binding.evidenceIds.length || binding.semanticObservationIds.length)) throw new Error('Missing rule requirements cannot carry positive evidence references.');
    if (binding.state === 'satisfied' && !binding.evidenceIds.length && !binding.semanticObservationIds.length) throw new Error('Satisfied rule requirements need positive evidence.');
    if (binding.state === 'satisfied' && binding.semanticObservationIds.some(id => !['observed', 'not_observed'].includes(observationById.get(id)!.state))) throw new Error('Satisfied semantic requirements need resolved observations inside the assessment interval.');
    if (binding.evidenceIds.some(id => { const interval = references.evidenceIntervals.get(id); return !interval || interval.endSec < assessment.interval.startSec || interval.startSec > assessment.interval.endSec; })) throw new Error('Bound rule evidence must overlap the assessment interval.');
    if (binding.semanticObservationIds.some(id => { const observation = observationById.get(id)!; return !observation.interval || observation.interval.endSec < assessment.interval.startSec || observation.interval.startSec > assessment.interval.endSec; })) throw new Error('Bound semantic observations must overlap the assessment interval.');
    binding.evidenceIds.forEach(id => boundEvidenceIds.add(id)); binding.semanticObservationIds.forEach(id => boundObservationIds.add(id));
  }
  const sameSet = (actual: string[], expected: Set<string>) => actual.length === expected.size && actual.every(value => expected.has(value));
  if (!sameSet(assessment.evidenceIds, boundEvidenceIds) || !sameSet(assessment.semanticObservationIds, boundObservationIds)) throw new Error('Rule assessment references must be derived from requirement bindings.');
  const missing = new Set(assessment.requirementBindings.filter(binding => binding.state === 'missing').map(binding => binding.requirement));
  const conflicting = new Set(assessment.requirementBindings.filter(binding => binding.state === 'conflicting').map(binding => binding.requirement));
  if (!sameSet(assessment.missingEvidence, missing) || !sameSet(assessment.conflictingEvidence, conflicting)) throw new Error('Missing and conflicting evidence must match requirement binding states.');
  if (assessment.applicability !== 'unknown' && assessment.requirementBindings.some(binding => binding.state !== 'satisfied')) throw new Error('Resolved applicability requires every evidence requirement to be satisfied.');
  const confidenceRank = { low: 0, medium: 1, high: 2 } as const;
  if (assessment.applicability !== 'unknown' && confidenceRank[assessment.confidence.level] < confidenceRank[definition.requiredConfidence]) throw new Error('Rule assessment confidence is below the source rule requirement.');
  if (assessment.applicability !== 'unknown' && [...boundEvidenceIds].some(id => { const confidence = references.evidenceConfidence.get(id); return !confidence || confidenceRank[confidence] < confidenceRank[definition.requiredConfidence] || confidenceRank[assessment.confidence.level] > confidenceRank[confidence]; })) throw new Error('Rule assessment confidence cannot exceed its bound deterministic evidence.');
  const boundConfidences = [...boundObservationIds].map(id => observationById.get(id)!.confidence);
  if (assessment.applicability !== 'unknown' && boundConfidences.some(confidence => confidenceRank[confidence.level] < confidenceRank[definition.requiredConfidence] || assessment.confidence.value > confidence.value || confidenceRank[assessment.confidence.level] > confidenceRank[confidence.level])) throw new Error('Rule assessment confidence cannot exceed its bound semantic observations.');
  const derivedProvenance = new Set<RuleAssessment['provenance'][number]>();
  boundEvidenceIds.forEach(id => { const provenance = references.evidenceProvenance.get(id); if (!provenance) throw new Error('Rule evidence provenance is missing.'); derivedProvenance.add(provenance); });
  boundObservationIds.forEach(id => derivedProvenance.add(observationById.get(id)!.provenance));
  if (!sameSet(assessment.provenance, derivedProvenance) || assessment.provenance.some(provenance => !definition.allowedProvenance.includes(provenance))) throw new Error('Rule assessment provenance must match referenced evidence and the source rule.');
}
