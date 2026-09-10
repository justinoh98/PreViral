// Versioned evaluator contracts. The model describes evidence; it never supplies stars.
export const RUBRIC_VERSION = 'previral-creative-v1';
export const EVIDENCE_VERSION = 'ordered-frames-audio-v2';
export const GROUNDING_VERSION = 'video-grounding-v3';
import type { TargetNiche } from './niches';
export const ASPECTS = ['hookStrength', 'pacingAndStimulation', 'narrativeAndPayoff', 'loopingAndRetention', 'technicalCompliance'] as const;
export type Aspect = typeof ASPECTS[number];
export const TRAITS = ['firstFrame', 'openingClarity', 'curiosity', 'anticipation', 'progression', 'pacing', 'visualInterest', 'payoff', 'setup', 'ending', 'replay', 'imageQuality', 'textLegibility', 'nonFollowerAppeal', 'shareability', 'conversion'] as const;
export type Trait = typeof TRAITS[number];
export const LEVELS = ['ineffective', 'weak', 'below_average', 'competent', 'strong', 'excellent', 'exceptional', 'outstanding', 'unknown', 'not_applicable'] as const;
export type Level = typeof LEVELS[number];
export type Confidence = 'high' | 'medium' | 'low';
export type Frame = { id: string; timeSec: number; imageUrl: string };
export type MediaEvidence = {
  version: string; durationSeconds: number; width: number; height: number;
  frames: Frame[]; audioWav?: string; audioStatus: 'provided' | 'unavailable' | 'absent';
  audioUnavailableReason?: string; samplingMode?: 'adaptive' | 'uniform'; sourceFingerprint?: string;
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
export type EvaluationRequest = {
  title: string; niche: TargetNiche; captionInput: string; videoConcept: string; audioType: string;
  fileFormat: string; fileSizeMb: number; language: 'en' | 'ko'; evidence: MediaEvidence;
};
