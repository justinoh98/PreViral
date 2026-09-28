// Versioned evaluator contracts. The model describes evidence; it never supplies stars.
export const RUBRIC_VERSION = 'previral-creative-v1';
export const EVIDENCE_SCHEMA_VERSION = 'ordered-frames-analysis-v3';
export const EVIDENCE_VERSION = EVIDENCE_SCHEMA_VERSION;
export const ANALYZER_VERSION = 'local-media-signals-v2';
export const GROUNDING_VERSION = 'video-grounding-v3';
export const SEMANTIC_SCHEMA_VERSION = 'semantic-observations-v1';
export const INVENTORY_SCHEMA_VERSION = 'semantic-inventory-v1';
export const EXTRACTOR_SCHEMA_VERSION = 'semantic-extractors-v1';
export const RULE_APPLICABILITY_VERSION = 'rule-applicability-v1';
export const CALIBRATION_VERSION = 'semantic-calibration-v1';
export const EVALUATION_VERSION_BOUNDARIES = Object.freeze({
  evidenceSchema: EVIDENCE_SCHEMA_VERSION,
  analyzer: ANALYZER_VERSION,
  sourceRules: 'source-rules-v1',
  rubric: RUBRIC_VERSION,
  semantic: Object.freeze({
    schema: SEMANTIC_SCHEMA_VERSION,
    inventory: INVENTORY_SCHEMA_VERSION,
    extractors: EXTRACTOR_SCHEMA_VERSION,
    applicability: RULE_APPLICABILITY_VERSION,
    calibration: CALIBRATION_VERSION,
  }),
});
import type { TargetNiche } from './niches';
export const ASPECTS = ['hookStrength', 'pacingAndStimulation', 'narrativeAndPayoff', 'loopingAndRetention', 'technicalCompliance'] as const;
export type Aspect = typeof ASPECTS[number];
export const TRAITS = ['firstFrame', 'openingClarity', 'curiosity', 'anticipation', 'progression', 'pacing', 'visualInterest', 'payoff', 'setup', 'ending', 'replay', 'imageQuality', 'textLegibility', 'nonFollowerAppeal', 'shareability', 'conversion'] as const;
export type Trait = typeof TRAITS[number];
export const LEVELS = ['ineffective', 'weak', 'below_average', 'competent', 'strong', 'excellent', 'exceptional', 'outstanding', 'unknown', 'not_applicable'] as const;
export type Level = typeof LEVELS[number];
export type Confidence = 'high' | 'medium' | 'low';
export type EvidenceState = 'available' | 'unavailable' | 'unknown';
export type EvidenceValueState = 'observed' | 'not_observed' | 'unknown' | 'unavailable' | 'not_applicable';
export type MeasurementProvenance = 'measured_local' | 'ocr_local' | 'transcript_local' | 'semantic_local' | 'semantic_remote';
export type EvidenceValue<T> = { state: EvidenceValueState; value: T | null; confidence: Confidence; evidenceIds: string[]; provenance: MeasurementProvenance; limitation?: string };
export type SemanticState = 'observed' | 'not_observed' | 'unknown' | 'not_applicable';
export type SemanticProvenance = 'measured_local' | 'ocr_local' | 'transcript_local' | 'semantic_local' | 'user_context';
export type CapabilityTier = 'high' | 'medium' | 'low';
export type LocalExecutionProvider = 'webgpu' | 'wasm' | 'none';
export type SemanticConfidence = { value: number; level: Confidence; calibrationVersion: string };
export type SemanticExtractorManifest = {
  id: string; version: string; state: 'available' | 'unavailable' | 'failed';
  purpose: string; runtime: string; runtimeRevision: string | null;
  executionProvider: LocalExecutionProvider; limitations: string[];
};
export type SemanticModelManifest = {
  id: string; revision: string; checksum: string; license: string;
  quantization: string | null; executionProvider: Exclude<LocalExecutionProvider, 'none'>;
  assetBytes: number; cached: boolean;
};
export type SemanticRuntimeQualification = {
  version: 'semantic-runtime-capabilities-v1'; tier: CapabilityTier;
  webgpu: { state: EvidenceState }; wasm: { state: EvidenceState; simd: boolean }; worker: { state: EvidenceState };
  constrained: boolean;
  warmupProfile: { id: string; revision: string; checksum: string; assetBytes: number; peakBytes: number; largestBufferBytes: number; providers: Array<Exclude<LocalExecutionProvider, 'none'>> } | null;
};
export type SemanticObservation<T = unknown> = {
  id: string; kind: string; state: SemanticState; value: T | null;
  evidenceIds: string[]; frameIds: string[]; shotIds: string[];
  interval: { startSec: number; endSec: number } | null;
  extractor: {
    id: string; version: string; modelId: string | null; modelRevision: string | null;
    runtime: string; runtimeRevision: string | null; executionProvider: LocalExecutionProvider; quantization: string | null;
  };
  provenance: SemanticProvenance; confidence: SemanticConfidence; uncertaintyReasons: string[];
};
export type FactualSemanticInventory = {
  id: string; version: string; fingerprint: string; durationSeconds: number;
  observationIds: string[];
  representativeFrames: Array<{ frameId: string; timeSec: number; selectionReasons: string[]; sourceEvidenceIds: string[] }>;
  shots: Array<{ shotId: string; startSec: number; endSec: number; representativeFrameIds: string[]; observationIds: string[] }>;
  openingObservationIds: string[]; dominantSubjectObservationIds: string[]; majorActionObservationIds: string[];
  progressionObservationIds: string[]; repeatedCompositionObservationIds: string[]; semanticRedundancyObservationIds: string[];
  strongestCandidateObservationIds: string[]; weakestCandidateObservationIds: string[];
  expectationObservationIds: string[]; payoffObservationIds: string[]; textObservationIds: string[];
  speechObservationIds: string[]; audioRoleObservationIds: string[]; endingObservationIds: string[];
  loopRewatchObservationIds: string[]; shareabilityObservationIds: string[]; accessibilityObservationIds: string[];
  confidence: SemanticConfidence; limitations: string[]; unknownObservationIds: string[];
};
export type SemanticVideoInventory = {
  version: string; inventoryId: string; fingerprint: string; durationSeconds: number;
  factualInventoryId: string;
  selectedTargetNiche: TargetNiche; factual: FactualSemanticInventory;
  capabilityTier: CapabilityTier; capabilityQualification: SemanticRuntimeQualification;
  extractors: SemanticExtractorManifest[]; models: SemanticModelManifest[];
  observations: SemanticObservation[]; contextualObservationIds: string[];
  limitations: string[]; partial: boolean;
};
export type RuleApplicability = 'applicable' | 'not_applicable' | 'unknown';
export type RuleOutcome = 'supports_principle' | 'concern_observed' | 'mixed' | 'not_applicable' | 'unknown';
export type RuleAssessment = {
  id: string; version: string; ruleId: string; requiredEvidence: string[];
  requirementBindings: Array<{ requirement: string; state: 'satisfied' | 'missing' | 'conflicting'; evidenceIds: string[]; semanticObservationIds: string[] }>;
  evidenceIds: string[]; semanticObservationIds: string[];
  interval: { startSec: number; endSec: number };
  applicability: RuleApplicability; outcome: RuleOutcome; confidence: SemanticConfidence;
  reason: string; sourceReferences: Array<{ document: string; pages: number[] }>;
  missingEvidence: string[]; conflictingEvidence: string[]; provenance: SemanticProvenance[];
};
export type CapabilityReport = {
  id: string; version: string; state: EvidenceState; mode: 'required' | 'optional' | 'experimental';
  provenance: MeasurementProvenance; limitations: string[];
};
export type Frame = { id: string; timeSec: number; imageUrl: string };
export type VisualMeasurement = {
  id: string; sourceFrameId: string; timeSec: number; perceptualHash: string;
  brightness: number; contrast: number; sharpness: number; blockiness: number;
  visualChangeFromPrevious: number; luminanceChangeFromPrevious: number; edgeChangeFromPrevious: number;
};
export type BoundaryEvidence = { kind: 'start' | 'candidate_transition' | 'candidate_hard_cut'; confidence: number; measurementId: string };
export type ShotEvidence = {
  id: string; startSec: number; endSec: number; durationSec: number; measurementIds: string[];
  representativeMeasurementId: string; representativeFrameId: string | null; boundary: BoundaryEvidence;
  withinShotVisualChange: { mean: number; max: number };
  quality: { brightness: number; contrast: number; sharpness: number; blockiness: number };
  similarShotIds: string[];
};
export type RepeatedShotCandidate = { id: string; shotIds: string[]; similarity: number; confidence: Confidence; provenance: 'measured_local' };
export type ActivityWindow = {
  id: string; startSec: number; endSec: number; measurementIds: string[];
  meanVisualChange: number; maxVisualChange: number; activityLevel: 'low' | 'medium' | 'high';
};
export type SimilarityMeasurement = EvidenceValue<number> & { id: string };
export type TechnicalEvidence = {
  frameCount: number; meanBrightness: number; meanContrast: number; meanSharpness: number; meanBlockiness: number;
  underexposedRatio: number; overexposedRatio: number; lowContrastRatio: number; lowSharpnessRatio: number;
};
export type AudioAnalysis = {
  version: string; trackState: 'available' | 'absent' | 'unavailable'; sampleRate: number | null; durationSeconds: number | null;
  onsetDelaySec: EvidenceValue<number>;
  envelope: Array<{ id: string; startSec: number; endSec: number; rms: number; peak: number; active: boolean }>;
  silenceIntervals: Array<{ id: string; startSec: number; endSec: number; confidence: Confidence }>;
  changePoints: Array<{ id: string; timeSec: number; magnitude: number; confidence: Confidence }>;
  trailingSilenceCandidate: EvidenceValue<boolean>; activeAtCutoffCandidate: EvidenceValue<boolean>;
  provenance: 'measured_local'; limitations: string[];
};
export type TextAnalysis = {
  state: 'observed' | 'not_observed' | 'unknown' | 'unavailable'; version: string;
  detections: Array<{ id: string; startSec: number; endSec: number; bounds: { x: number; y: number; width: number; height: number }; confidence: number; wording: string | null; safeZoneOverlap: boolean | null }>;
  provenance: 'ocr_local'; limitations: string[];
};
export type EvidenceAnalysis = {
  version: string; schemaVersion: string; sourceFingerprint: string; provenance: 'measured_local'; capabilities: CapabilityReport[];
  measurements: VisualMeasurement[]; shots: ShotEvidence[]; repeatedShotCandidates: RepeatedShotCandidate[];
  firstFrame: { id: string; measurementId: string; timeSec: number };
  endingFrame: { id: string; measurementId: string; timeSec: number };
  opening: ActivityWindow; endingTail: ActivityWindow; startEndSimilarity: SimilarityMeasurement;
  technical: TechnicalEvidence; audio: AudioAnalysis; text: TextAnalysis; limitations: string[];
};
export type MediaEvidence = {
  version: string; durationSeconds: number; width: number; height: number;
  frames: Frame[]; audioWav?: string; audioStatus: 'provided' | 'unavailable' | 'absent';
  audioUnavailableReason?: string; samplingMode?: 'adaptive' | 'uniform'; sourceFingerprint?: string;
  analysis?: EvidenceAnalysis;
};
export type Judgment = { level: Level; confidence: Confidence; reason: string; frameIds: string[] };
export type Scene = { id: string; section: 'opening' | 'middle' | 'ending'; description: string; frameIds: string[] };
export const INVENTORY_ELEMENTS = ['strongestMoment', 'weakestSection', 'repetition', 'payoff', 'onScreenText', 'speech', 'audioBehavior'] as const;
export type InventoryElement = { state: 'observed' | 'not_observed' | 'unclear'; description: string; sceneIds: string[] };
export type VideoInventory = {
  mainSubject: string; structure: string; scenes: Scene[];
  visibleText?: Array<{ sceneId: string; frameIds: string[]; state: 'legible' | 'unclear'; wording: string | null }>;
  observedActions?: Array<{ sceneId: string; frameIds: string[]; description: string }>;
  openingSceneId: string; endingSceneId: string; majorProgression: string[];
  elements: Record<typeof INVENTORY_ELEMENTS[number], InventoryElement>;
  confidence: Confidence; limitations: string[];
};
export type GroundingStatus = 'HIGH' | 'MEDIUM' | 'LOW' | 'FAILED';
export type GroundingReport = {
  version: string; targetNiche: TargetNiche; status: GroundingStatus;
  inventory: VideoInventory | null; issues: string[]; attempts: number; verifiedSceneIds: string[];
};
export type AspectContext = { sceneIds: string[]; interpretation: string; nicheReason: string };
export type Interpretation = {
  targetNiche: TargetNiche; observations: Observations; aspectContext: Record<Aspect, AspectContext>;
};
export type GroundedContext = { grounding: GroundingReport; aspectContext: Record<Aspect, AspectContext> };
export type Weakness = {
  id: string; aspect: Aspect; severity: 'minor' | 'major' | 'severe';
  problem: string; sceneIds: string[];
};
export type Observations = {
  concept: string; confidence: Confidence; coverage: 'sufficient' | 'insufficient';
  audioEssential: boolean; limitations: string[];
  scenes: Scene[]; traits: Record<Trait, Judgment>; weaknesses: Weakness[];
  strengths: Array<{ description: string; sceneIds: string[] }>;
  strongestSceneId: string | null; reusableHookSceneId: string | null;
  textObservation: string; audioObservation: string;
  watermark: 'present' | 'absent' | 'unknown'; safeZone: 'clear' | 'violation' | 'unknown';
};
export type Edit = {
  id: string; weaknessId: string | null; priority: 'must_fix' | 'should_improve' | 'optional';
  action: 'KEEP' | 'REMOVE' | 'SHORTEN' | 'MOVE' | 'REPLACE' | 'INSERT';
  sceneIds: string[]; footage: 'existing' | 'reshoot';
  targetSceneId: string; sourceSceneIds: string[];
  destination: { relation: 'before' | 'after' | 'replace' | 'within'; sceneId: string } | null;
  problem: string; editThis: string; useThis: string; why: string;
  copyKind: 'none' | 'overlay' | 'caption' | 'cta'; copy: string; copyBefore?: string | null;
};
export type Feedback = {
  aspectNotes: Record<Aspect, { verdict: string; detail: string; sceneIds: string[] }>;
  strengths: string[]; weaknesses: string[]; textObservation: string; audioObservation: string;
  summary: string; keep: Array<{ sceneId: string; instruction: string }>;
  edits: Edit[]; reeditPlan: Array<{ editId: string; instruction: string }>;
  textPlaybook?: Array<{ sceneId: string; stage: string; guidance: string; direct: string; curiosity: string; story: string }>;
  caption: string; captionHooks: string[]; valueCTA: string; cliffhangerCTA: string;
  commentQuestion: string; hashtags: string[];
};
export type ScoreResult = {
  version: string; aspectScores: Record<Aspect, number>; overallStars: number; overallScorePercent: number;
  verdict: 'Viral Contender' | 'Strong Growth' | 'Moderate Retention' | 'High Skip Risk';
  skipEstimate: { low: number; high: number; midpoint: number; band: 'low' | 'moderate' | 'high' | 'very_high'; basis: 'heuristic_not_empirically_calibrated' };
  nonFollowerInterestStars: number | null; conversionIndex: number | null; shareabilityIndex: number | null;
  appliedRules: Array<{ aspect: Aspect; rule: string }>;
};
export type GrowthPrediction = {
  low: number; high: number; midpoint: number; confidence: Confidence;
  basis: 'heuristic_not_empirically_calibrated'; explanation: string;
};
export type EvaluationRequest = {
  title: string; niche: TargetNiche; captionInput: string; videoConcept: string; audioType: string;
  fileFormat: string; fileSizeMb: number; language: 'en' | 'ko'; evidence: MediaEvidence;
};
