import test from 'node:test';
import assert from 'node:assert/strict';
import { CALIBRATION_VERSION, INVENTORY_SCHEMA_VERSION, RULE_APPLICABILITY_VERSION, type RuleAssessment, type SemanticExtractorManifest, type SemanticObservation, type SemanticVideoInventory } from '../../evaluation/contracts';
import { validateRuleAssessment, validateSemanticInventory, validateSemanticObservation, type SemanticReferenceIndex } from '../../evaluation/semanticValidation';
import { RULE_FAMILIES } from '../../evaluation/sourceRules';
import { contextualInventoryId, semanticId } from '../../evaluation/semanticIds';

const refs: SemanticReferenceIndex = {
  fingerprint: `sha256-${'a'.repeat(64)}`,
  durationSeconds: 12,
  evidenceIds: new Set(['MEASUREMENT_1', 'FRAME_1', 'SHOT_1']),
  frameIds: new Set(['FRAME_1']),
  shotIds: new Set(['SHOT_1']),
  frameTimes: new Map([['FRAME_1', 0]]),
  shotIntervals: new Map([['SHOT_1', { startSec: 0, endSec: 12 }]]),
  evidenceIntervals: new Map([['MEASUREMENT_1', { startSec: 0, endSec: 12 }], ['FRAME_1', { startSec: 0, endSec: 0 }], ['SHOT_1', { startSec: 0, endSec: 12 }]]),
  evidenceProvenance: new Map([['MEASUREMENT_1', 'measured_local'], ['FRAME_1', 'measured_local'], ['SHOT_1', 'measured_local']]),
  evidenceConfidence: new Map([['MEASUREMENT_1', 'high'], ['FRAME_1', 'high'], ['SHOT_1', 'high']]),
};
const semanticObservationId = semanticId('observation', 1, 0, 3, refs.fingerprint);
const factualInventoryId = semanticId('inventory', 1, 0, refs.durationSeconds, refs.fingerprint);
const ruleAssessmentId = semanticId('applicability', 1, 0, 3, refs.fingerprint);
const capabilityQualification = () => ({
  version: 'semantic-runtime-capabilities-v1' as const, tier: 'low' as const,
  webgpu: { state: 'unavailable' as const }, wasm: { state: 'available' as const, simd: true }, worker: { state: 'available' as const }, constrained: false,
  warmupProfile: { id: 'fixture-model', revision: 'v1', checksum: `sha256-${'f'.repeat(64)}`, assetBytes: 1, peakBytes: 64_000_000, largestBufferBytes: 32_000_000, providers: ['wasm' as const] },
});

const observation = (): SemanticObservation<string> => ({
  id: semanticObservationId, kind: 'opening_subject', state: 'observed', value: 'a red model car',
  evidenceIds: ['MEASUREMENT_1'], frameIds: ['FRAME_1'], shotIds: ['SHOT_1'], interval: { startSec: 0, endSec: 3 },
  extractor: { id: 'fixture', version: 'v1', modelId: null, modelRevision: null, runtime: 'fixture', runtimeRevision: 'v1', executionProvider: 'wasm', quantization: null },
  provenance: 'semantic_local', confidence: { value: .8, level: 'high', calibrationVersion: CALIBRATION_VERSION }, uncertaintyReasons: [],
});
const extractorManifest = (): SemanticExtractorManifest => ({ id: 'fixture', version: 'v1', state: 'available', purpose: 'fixture', runtime: 'fixture', runtimeRevision: 'v1', executionProvider: 'wasm', limitations: [] });

test('semantic validation accepts a fully traceable observation', () => {
  assert.doesNotThrow(() => validateSemanticObservation(observation(), refs, [extractorManifest()]));
  const failed = extractorManifest(); failed.state = 'failed';
  assert.throws(() => validateSemanticObservation(observation(), refs, [failed]), /available extractor manifest/);
});

test('observed claims require value, footage references, interval, and valid confidence', () => {
  for (const mutate of [
    (row: SemanticObservation<string>) => { row.value = null; },
    (row: SemanticObservation<string>) => { row.frameIds = []; },
    (row: SemanticObservation<string>) => { row.shotIds = ['MISSING']; },
    (row: SemanticObservation<string>) => { row.interval = null; },
    (row: SemanticObservation<string>) => { row.confidence.value = 2; },
  ]) {
    const row = observation(); mutate(row);
    assert.throws(() => validateSemanticObservation(row, refs, [extractorManifest()]));
  }
});

test('unknown claims carry uncertainty and cannot pretend to have a value', () => {
  const row = observation(); row.state = 'unknown'; row.value = null; row.evidenceIds = []; row.frameIds = []; row.shotIds = []; row.interval = null; row.uncertaintyReasons = ['Extractor unavailable.']; row.confidence = { value: 0, level: 'low', calibrationVersion: CALIBRATION_VERSION };
  assert.doesNotThrow(() => validateSemanticObservation(row, refs));
  row.uncertaintyReasons = [];
  assert.throws(() => validateSemanticObservation(row, refs));
});

test('rule assessments require compatible applicability outcomes and known evidence', () => {
  const definition = RULE_FAMILIES.OPENING_VISUAL_STRENGTH;
  const assessment: RuleAssessment = {
    id: ruleAssessmentId, version: RULE_APPLICABILITY_VERSION, ruleId: definition.ruleId,
    requiredEvidence: [...definition.requiredEvidence], requirementBindings: definition.requiredEvidence.map(requirement => ({ requirement, state: 'missing', evidenceIds: [], semanticObservationIds: [] })),
    evidenceIds: [], semanticObservationIds: [], interval: { startSec: 0, endSec: 3 },
    applicability: 'unknown', outcome: 'unknown', confidence: { value: 0, level: 'low', calibrationVersion: CALIBRATION_VERSION },
    reason: 'Semantic extraction has not run.', sourceReferences: definition.sources.map(source => ({ document: source.document, pages: [...source.pages] })),
    missingEvidence: [...definition.requiredEvidence], conflictingEvidence: [], provenance: [],
  };
  assert.doesNotThrow(() => validateRuleAssessment(assessment, refs, [observation()], [extractorManifest()]));
  assessment.applicability = 'not_applicable';
  assert.throws(() => validateRuleAssessment(assessment, refs, [observation()], [extractorManifest()]), /outcome/);
});

test('resolved rule assessments bind every requirement, derive provenance, and enforce confidence', () => {
  const definition = RULE_FAMILIES.OPENING_VISUAL_STRENGTH;
  const row = observation();
  const assessment: RuleAssessment = {
    id: ruleAssessmentId, version: RULE_APPLICABILITY_VERSION, ruleId: definition.ruleId, requiredEvidence: [...definition.requiredEvidence],
    requirementBindings: definition.requiredEvidence.map((requirement, index) => ({ requirement, state: 'satisfied', evidenceIds: index < 2 ? ['MEASUREMENT_1'] : [], semanticObservationIds: index === 2 ? [row.id] : [] })),
    evidenceIds: ['MEASUREMENT_1'], semanticObservationIds: [row.id], interval: { startSec: 0, endSec: 3 }, applicability: 'applicable', outcome: 'supports_principle',
    confidence: { value: .8, level: 'high', calibrationVersion: CALIBRATION_VERSION }, reason: 'The opening is visually clear.', sourceReferences: definition.sources.map(source => ({ document: source.document, pages: [...source.pages] })),
    missingEvidence: [], conflictingEvidence: [], provenance: ['measured_local', 'semantic_local'],
  };
  assert.doesNotThrow(() => validateRuleAssessment(assessment, refs, [row], [extractorManifest()]));
  assessment.confidence.level = 'low';
  assert.throws(() => validateRuleAssessment(assessment, refs, [row], [extractorManifest()]), /confidence/);
  assessment.confidence.level = 'high'; assessment.provenance = ['semantic_local'];
  assert.throws(() => validateRuleAssessment(assessment, refs, [row], [extractorManifest()]), /provenance/);
  assessment.provenance = ['measured_local', 'semantic_local']; row.confidence = { value: .4, level: 'low', calibrationVersion: CALIBRATION_VERSION };
  assert.throws(() => validateRuleAssessment(assessment, refs, [row], [extractorManifest()]), /confidence/);
  row.confidence = { value: .8, level: 'high', calibrationVersion: CALIBRATION_VERSION }; assessment.interval = { startSec: 4, endSec: 6 }; assessment.id = semanticId('applicability', 1, 4, 6, refs.fingerprint);
  assert.throws(() => validateRuleAssessment(assessment, refs, [row], [extractorManifest()]), /overlap the assessment interval/);
  assessment.interval = { startSec: 0, endSec: 3 }; assessment.id = ruleAssessmentId;
  row.state = 'unknown'; row.value = null; row.evidenceIds = []; row.frameIds = []; row.shotIds = []; row.interval = null; row.uncertaintyReasons = ['Model uncertainty.']; row.confidence = { value: 0, level: 'low', calibrationVersion: CALIBRATION_VERSION };
  assert.throws(() => validateRuleAssessment(assessment, refs, [row], [extractorManifest()]), /resolved observations/);
});

test('semantic contracts reject numerical scoring vocabulary anywhere in the payload', () => {
  for (const value of [{ scoreEffect: -1 }, { rating: 4 }, { penalty: 1 }, { starRating: 5 }, { overallRating: 4 }, { aspectScores: {} }, { overallScorePercent: 100 }, { skipEstimate: {} }, { appliedRules: [] }, { conversionIndex: 2 }, { shareabilityIndex: 3 }, { nonFollowerInterestStars: 4 }]) {
    const row = { ...observation(), value } as unknown as SemanticObservation;
    assert.throws(() => validateSemanticObservation(row, refs, [extractorManifest()]), /numerical scoring/);
  }
});

test('semantic inventory keeps factual observations content-bound and niche context separate', () => {
  const row = observation();
  row.extractor.executionProvider = 'wasm';
  const factualId = factualInventoryId;
  const inventory: SemanticVideoInventory = {
    version: INVENTORY_SCHEMA_VERSION, inventoryId: contextualInventoryId(factualId, 'Photography'), factualInventoryId: factualId, fingerprint: refs.fingerprint, durationSeconds: 12,
    selectedTargetNiche: 'Photography', capabilityTier: 'low', capabilityQualification: capabilityQualification(), extractors: [{ id: 'fixture', version: 'v1', state: 'available', purpose: 'fixture', runtime: 'fixture', runtimeRevision: 'v1', executionProvider: 'wasm', limitations: [] }], models: [], observations: [row], contextualObservationIds: [], limitations: [], partial: true,
    factual: {
      id: factualId, version: INVENTORY_SCHEMA_VERSION, fingerprint: refs.fingerprint, durationSeconds: 12,
      observationIds: [row.id], representativeFrames: [{ frameId: 'FRAME_1', timeSec: 0, selectionReasons: ['actual_first_frame'], sourceEvidenceIds: ['FRAME_1'] }],
      shots: [{ shotId: 'SHOT_1', startSec: 0, endSec: 12, representativeFrameIds: ['FRAME_1'], observationIds: [row.id] }],
      openingObservationIds: [row.id], dominantSubjectObservationIds: [row.id], majorActionObservationIds: [], progressionObservationIds: [], repeatedCompositionObservationIds: [], semanticRedundancyObservationIds: [],
      strongestCandidateObservationIds: [], weakestCandidateObservationIds: [], expectationObservationIds: [], payoffObservationIds: [], textObservationIds: [], speechObservationIds: [], audioRoleObservationIds: [], endingObservationIds: [], loopRewatchObservationIds: [], shareabilityObservationIds: [], accessibilityObservationIds: [],
      confidence: row.confidence, limitations: ['Semantic models have not run.'], unknownObservationIds: [],
    },
  };
  assert.doesNotThrow(() => validateSemanticInventory(inventory, refs));
  inventory.capabilityTier = 'high';
  assert.throws(() => validateSemanticInventory(inventory, refs), /qualification|warm-up/);
  inventory.capabilityTier = 'low';
  inventory.models.push({ id: 'bad-model', revision: 'v1', checksum: `sha256-${'d'.repeat(64)}`, license: 'test', quantization: null, executionProvider: 'wasm', assetBytes: 1, cached: 'yes' as unknown as boolean });
  assert.throws(() => validateSemanticInventory(inventory, refs), /model manifest/);
  inventory.models = [];
  row.extractor.modelId = 'other-model'; row.extractor.modelRevision = 'v1'; row.extractor.quantization = 'int8';
  inventory.models.push({ id: 'other-model', revision: 'v1', checksum: `sha256-${'d'.repeat(64)}`, license: 'test', quantization: 'int8', executionProvider: 'wasm', assetBytes: 1, cached: false });
  assert.throws(() => validateSemanticInventory(inventory, refs), /allocation-qualified model/);
  row.extractor.modelId = null; row.extractor.modelRevision = null; row.extractor.quantization = null; inventory.models = [];
  const contextual = { ...observation(), id: semanticId('observation', 2, 0, 3, refs.fingerprint), kind: 'niche_context', provenance: 'user_context' as const };
  inventory.observations.push(contextual); inventory.contextualObservationIds.push(contextual.id); inventory.factual.openingObservationIds = [contextual.id];
  assert.throws(() => validateSemanticInventory(inventory, refs), /openingObservationIds/);
  inventory.observations.pop(); inventory.contextualObservationIds = []; inventory.factual.openingObservationIds = [row.id];
  row.extractor.id = 'missing-extractor';
  assert.throws(() => validateSemanticInventory(inventory, refs), /extractor/);
  row.extractor.id = 'fixture';
  inventory.factual.fingerprint = `sha256-${'b'.repeat(64)}`;
  assert.throws(() => validateSemanticInventory(inventory, refs), /fingerprint/);
});

test('inventory validation rejects facts from failed extractors and context in the factual partition', () => {
  const row = observation(); row.extractor.executionProvider = 'wasm';
  const factualId = factualInventoryId;
  const inventory: SemanticVideoInventory = {
    version: INVENTORY_SCHEMA_VERSION, inventoryId: contextualInventoryId(factualId, 'Photography'), factualInventoryId: factualId,
    fingerprint: refs.fingerprint, durationSeconds: 12, selectedTargetNiche: 'Photography', capabilityTier: 'low', capabilityQualification: capabilityQualification(),
    extractors: [{ id: 'fixture', version: 'v1', state: 'failed', purpose: 'fixture', runtime: 'fixture', runtimeRevision: 'v1', executionProvider: 'wasm', limitations: ['failed'] }],
    models: [], observations: [row], contextualObservationIds: [], limitations: [], partial: true,
    factual: {
      id: factualId, version: INVENTORY_SCHEMA_VERSION, fingerprint: refs.fingerprint, durationSeconds: 12, observationIds: [row.id],
      representativeFrames: [{ frameId: 'FRAME_1', timeSec: 0, selectionReasons: ['actual_first_frame'], sourceEvidenceIds: ['FRAME_1'] }],
      shots: [{ shotId: 'SHOT_1', startSec: 0, endSec: 12, representativeFrameIds: ['FRAME_1'], observationIds: [row.id] }],
      openingObservationIds: [row.id], dominantSubjectObservationIds: [], majorActionObservationIds: [], progressionObservationIds: [], repeatedCompositionObservationIds: [], semanticRedundancyObservationIds: [], strongestCandidateObservationIds: [], weakestCandidateObservationIds: [], expectationObservationIds: [], payoffObservationIds: [], textObservationIds: [], speechObservationIds: [], audioRoleObservationIds: [], endingObservationIds: [], loopRewatchObservationIds: [], shareabilityObservationIds: [], accessibilityObservationIds: [], confidence: row.confidence, limitations: [], unknownObservationIds: [],
    },
  };
  assert.throws(() => validateSemanticInventory(inventory, refs), /available extractor/);
  inventory.extractors[0].state = 'available'; row.provenance = 'user_context';
  assert.throws(() => validateSemanticInventory(inventory, refs), /factual observation graph/);
});

test('semantic IDs, extractor manifests, factual partitions, and rule decisions are referentially enforced', () => {
  const row = observation(); row.id = 'arbitrary';
  assert.throws(() => validateSemanticObservation(row, refs, [extractorManifest()]), /ID/);
  const assessment: RuleAssessment = {
    id: ruleAssessmentId, version: RULE_APPLICABILITY_VERSION, ruleId: RULE_FAMILIES.OPENING_VISUAL_STRENGTH.ruleId,
    requiredEvidence: [...RULE_FAMILIES.OPENING_VISUAL_STRENGTH.requiredEvidence], requirementBindings: RULE_FAMILIES.OPENING_VISUAL_STRENGTH.requiredEvidence.map(requirement => ({ requirement, state: 'missing', evidenceIds: [], semanticObservationIds: [] })), evidenceIds: [], semanticObservationIds: [], interval: { startSec: 0, endSec: 3 }, applicability: 'not_applicable', outcome: 'not_applicable',
    confidence: { value: .8, level: 'high', calibrationVersion: CALIBRATION_VERSION }, reason: 'The opening is visually self-sufficient.', sourceReferences: RULE_FAMILIES.OPENING_VISUAL_STRENGTH.sources.map(source => ({ document: source.document, pages: [...source.pages] })), missingEvidence: [], conflictingEvidence: [], provenance: ['semantic_local'],
  };
  assert.throws(() => validateRuleAssessment(assessment, refs, [], []), /positive evidence/);
});
