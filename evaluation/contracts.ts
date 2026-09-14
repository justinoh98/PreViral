// Versioned evaluator contracts. The model describes evidence; it never supplies stars.
export const RUBRIC_VERSION = 'previral-creative-v1';
export const EVIDENCE_SCHEMA_VERSION = 'ordered-frames-analysis-v3';
export const EVIDENCE_VERSION = EVIDENCE_SCHEMA_VERSION;
export const ANALYZER_VERSION = 'local-media-signals-v2';
export const GROUNDING_VERSION = 'video-grounding-v3';
export const EVALUATION_VERSION_BOUNDARIES = Object.freeze({
  evidenceSchema: EVIDENCE_SCHEMA_VERSION,
  analyzer: ANALYZER_VERSION,
  sourceRules: 'source-rules-v1',
  rubric: RUBRIC_VERSION,
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
