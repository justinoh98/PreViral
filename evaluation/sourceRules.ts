import type { Aspect, Confidence } from './contracts';

export const RULE_REGISTRY_VERSION = 'source-rules-v1';

export type SourceDocumentId = 'GENERAL_GUIDELINE' | 'LOW_SKIP_CHECKLIST' | 'LOW_SKIP_SUMMARY';
export type RuleClassification = 'universal' | 'conditional' | 'advisory';
export type Applicability = 'applicable' | 'not_applicable' | 'unknown';
export type EvidenceProvenance = 'measured_local' | 'ocr_local' | 'transcript_local' | 'semantic_local' | 'semantic_remote' | 'user_context';
export type RuleAspect = Aspect | 'conversionEstimate' | 'shareabilityEstimate' | 'nonFollowerEstimate';

export const CANONICAL_SOURCES: Readonly<Record<SourceDocumentId, {
  file: string;
  pageCount: number;
  role: string;
  derivativeOf?: SourceDocumentId;
}>> = Object.freeze({
  GENERAL_GUIDELINE: {
    file: 'docs/sources/General_Guideline_for_High-Retention_&_Growth-Focu.pdf',
    pageCount: 3,
    role: 'Broad retention, growth, shareability, CTA, and technical presentation framework.',
  },
  LOW_SKIP_CHECKLIST: {
    file: 'docs/sources/Reel Low-Skip Checklist.pdf',
    pageCount: 9,
    role: 'Strict diagnostic checklist for hooks, pacing, payoff, looping, quality, and shareability.',
  },
  LOW_SKIP_SUMMARY: {
    file: 'docs/sources/reel_low_skip_summary.pdf',
    pageCount: 3,
    role: 'Condensed derivative summary used to reinforce principles, never to multiply scoring weight.',
    derivativeOf: 'LOW_SKIP_CHECKLIST',
  },
});

export type RuleFamilyDefinition = {
  ruleId: string;
  PreViralAspect: RuleAspect;
  classification: RuleClassification;
  principle: string;
  sources: Array<{ document: SourceDocumentId; pages: number[] }>;
  requiredEvidence: string[];
  applicabilityConditions: string;
  requiredConfidence: Exclude<Confidence, 'low'>;
  possibleSeverity: Array<'minor' | 'major' | 'severe'>;
  scoreAffecting: boolean;
  feedbackOnly: boolean;
  allowedProvenance: EvidenceProvenance[];
  notes: string;
};

const visualSemantic: EvidenceProvenance[] = ['measured_local', 'ocr_local', 'transcript_local', 'semantic_local', 'semantic_remote'];
const semantic: EvidenceProvenance[] = ['ocr_local', 'transcript_local', 'semantic_local', 'semantic_remote'];
const source = (document: SourceDocumentId, ...pages: number[]) => ({ document, pages });
const rule = (definition: RuleFamilyDefinition): RuleFamilyDefinition => definition;

export const RULE_FAMILIES = Object.freeze({
  HOOK_IMMEDIACY: rule({
    ruleId: 'RULE_HOOK_IMMEDIACY', PreViralAspect: 'hookStrength', classification: 'universal',
    principle: 'The actual opening should provide an immediate evidence-backed reason to continue.',
    sources: [source('GENERAL_GUIDELINE', 1), source('LOW_SKIP_CHECKLIST', 2, 7), source('LOW_SKIP_SUMMARY', 1, 3)],
    requiredEvidence: ['actual first frame', 'ordered opening evidence from 0–3 seconds', 'semantic opening interpretation'],
    applicabilityConditions: 'Always assess the opening; motion, stillness, text, sound, beauty, tension, emotion, and novelty are alternative mechanisms.',
    requiredConfidence: 'medium', possibleSeverity: ['minor', 'major', 'severe'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: visualSemantic, notes: 'Later footage cannot retroactively improve the opening judgment.',
  }),
  HOOK_CLARITY_AND_PROMISE: rule({
    ruleId: 'RULE_HOOK_CLARITY_AND_PROMISE', PreViralAspect: 'hookStrength', classification: 'universal',
    principle: 'The opening should establish value, a question, or an intentional reason for ambiguity.',
    sources: [source('GENERAL_GUIDELINE', 1), source('LOW_SKIP_CHECKLIST', 2), source('LOW_SKIP_SUMMARY', 1)],
    requiredEvidence: ['opening subject or action', 'visible text meaning when present', 'transcript meaning when available'],
    applicabilityConditions: 'Always assess, while allowing deliberately intriguing ambiguity that gives viewers a reason to stay.',
    requiredConfidence: 'medium', possibleSeverity: ['minor', 'major', 'severe'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: semantic, notes: 'The selected niche contextualizes audience interpretation but cannot establish facts.',
  }),
  OPENING_VISUAL_STRENGTH: rule({
    ruleId: 'RULE_OPENING_VISUAL_STRENGTH', PreViralAspect: 'hookStrength', classification: 'conditional',
    principle: 'The first visual should provide stopping power appropriate to the concept.',
    sources: [source('GENERAL_GUIDELINE', 1), source('LOW_SKIP_CHECKLIST', 2), source('LOW_SKIP_SUMMARY', 1)],
    requiredEvidence: ['actual first frame', 'opening visual activity', 'semantic intrigue or clarity'],
    applicabilityConditions: 'Low motion is adverse only when no compensating intrigue, tension, beauty, clarity, or intentionality is supported.',
    requiredConfidence: 'medium', possibleSeverity: ['minor', 'major', 'severe'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: visualSemantic, notes: 'Low motion is a measurement, not a boredom judgment.',
  }),
  OPENING_TEXT_SUPPORT: rule({
    ruleId: 'RULE_OPENING_TEXT_SUPPORT', PreViralAspect: 'hookStrength', classification: 'conditional',
    principle: 'Opening text can clarify a promise or curiosity gap when verbal framing is needed.',
    sources: [source('GENERAL_GUIDELINE', 1), source('LOW_SKIP_CHECKLIST', 2), source('LOW_SKIP_SUMMARY', 1)],
    requiredEvidence: ['text presence', 'OCR confidence and bounds', 'opening meaning without text'],
    applicabilityConditions: 'Applicable when text is used or comprehension depends on verbal framing; otherwise absence of text is valid.',
    requiredConfidence: 'high', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: ['ocr_local', 'semantic_local', 'semantic_remote'], notes: 'Never invent unreadable wording.',
  }),
  OPENING_AUDIO_SUPPORT: rule({
    ruleId: 'RULE_OPENING_AUDIO_SUPPORT', PreViralAspect: 'hookStrength', classification: 'conditional',
    principle: 'Audio should begin promptly when it is an intended or necessary opening mechanism.',
    sources: [source('GENERAL_GUIDELINE', 3), source('LOW_SKIP_CHECKLIST', 2), source('LOW_SKIP_SUMMARY', 1)],
    requiredEvidence: ['audio track state', 'measured onset delay', 'semantic audio importance'],
    applicabilityConditions: 'Applicable only when audio is essential or clearly supports the hook; deliberate silence may be valid.',
    requiredConfidence: 'high', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: ['measured_local', 'transcript_local', 'semantic_local', 'semantic_remote'], notes: 'Audio activity does not identify music, speech, or meaning.',
  }),
  PACING_PROGRESS: rule({
    ruleId: 'RULE_PACING_PROGRESS', PreViralAspect: 'pacingAndStimulation', classification: 'universal',
    principle: 'Viewer value should develop or be intentionally sustained at a pace appropriate to the concept.',
    sources: [source('GENERAL_GUIDELINE', 1), source('LOW_SKIP_CHECKLIST', 3), source('LOW_SKIP_SUMMARY', 1, 3)],
    requiredEvidence: ['shot timeline', 'within-shot change', 'semantic progression'],
    applicabilityConditions: 'Always assess progression; a 1–2 second cadence is only a risk signal for formats that depend on rapid delivery.',
    requiredConfidence: 'medium', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: visualSemantic, notes: 'Cut frequency is neither inherently positive nor negative.',
  }),
  DEAD_TIME: rule({
    ruleId: 'RULE_DEAD_TIME', PreViralAspect: 'pacingAndStimulation', classification: 'conditional',
    principle: 'A passage is dead time only when it adds no information, atmosphere, tension, rhythm, emotion, or necessary readability.',
    sources: [source('GENERAL_GUIDELINE', 1), source('LOW_SKIP_CHECKLIST', 3), source('LOW_SKIP_SUMMARY', 1, 3)],
    requiredEvidence: ['shot duration', 'visual activity', 'audio activity', 'semantic purpose'],
    applicabilityConditions: 'Both measured inactivity or repetition and semantic lack of purpose must be supported.',
    requiredConfidence: 'high', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: visualSemantic, notes: 'Silence and stillness alone are not dead time.',
  }),
  REDUNDANT_VISUALS: rule({
    ruleId: 'RULE_REDUNDANT_VISUALS', PreViralAspect: 'pacingAndStimulation', classification: 'conditional',
    principle: 'Repeated footage should add information, emphasis, rhythm, emotion, or comparison.',
    sources: [source('LOW_SKIP_CHECKLIST', 3, 7), source('LOW_SKIP_SUMMARY', 1, 3)],
    requiredEvidence: ['perceptual similarity candidates', 'distinct shot IDs', 'semantic novelty comparison'],
    applicabilityConditions: 'Applicable only when distinct near-duplicate passages add no new viewer value.',
    requiredConfidence: 'high', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: ['measured_local', 'semantic_local', 'semantic_remote'], notes: 'Samples within one shot are not repeated shots.',
  }),
  VISUAL_EXPLANATION: rule({
    ruleId: 'RULE_VISUAL_EXPLANATION', PreViralAspect: 'narrativeAndPayoff', classification: 'conditional',
    principle: 'Explanation should receive visual support when visuals are necessary for comprehension.',
    sources: [source('GENERAL_GUIDELINE', 1), source('LOW_SKIP_CHECKLIST', 3)],
    requiredEvidence: ['spoken or visible explanation', 'supporting observed visuals'],
    applicabilityConditions: 'Applicable to an explanation whose essential meaning is not otherwise visible.',
    requiredConfidence: 'medium', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: semantic, notes: 'This is not a B-roll quota.',
  }),
  NARRATIVE_PROGRESS: rule({
    ruleId: 'RULE_NARRATIVE_PROGRESS', PreViralAspect: 'narrativeAndPayoff', classification: 'universal',
    principle: 'The sequence should form understandable development appropriate to its creative format.',
    sources: [source('GENERAL_GUIDELINE', 1, 2), source('LOW_SKIP_CHECKLIST', 4), source('LOW_SKIP_SUMMARY', 1, 2, 3)],
    requiredEvidence: ['ordered semantic scenes', 'setup or premise', 'ending'],
    applicabilityConditions: 'Always assess; valid structures include process, argument, joke, performance, mood evolution, reveal, and continuous action.',
    requiredConfidence: 'medium', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: semantic, notes: 'Do not require a literal tutorial structure.',
  }),
  PAYOFF_DELIVERY: rule({
    ruleId: 'RULE_PAYOFF_DELIVERY', PreViralAspect: 'narrativeAndPayoff', classification: 'universal',
    principle: 'A promise or established expectation should receive an appropriate resolution.',
    sources: [source('GENERAL_GUIDELINE', 1, 2), source('LOW_SKIP_CHECKLIST', 4), source('LOW_SKIP_SUMMARY', 1, 3)],
    requiredEvidence: ['opening expectation', 'later result, insight, joke, emotion, or completed action'],
    applicabilityConditions: 'Assess whether the concept creates an expectation; do not invent a reveal when none is intended.',
    requiredConfidence: 'medium', possibleSeverity: ['minor', 'major', 'severe'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: semantic, notes: 'A payoff need not be a visual transformation.',
  }),
  PAYOFF_TIMING: rule({
    ruleId: 'RULE_PAYOFF_TIMING', PreViralAspect: 'narrativeAndPayoff', classification: 'conditional',
    principle: 'Promised value should not be delayed beyond the interest sustained by the setup.',
    sources: [source('GENERAL_GUIDELINE', 2), source('LOW_SKIP_CHECKLIST', 4), source('LOW_SKIP_SUMMARY', 1, 3)],
    requiredEvidence: ['setup interval', 'payoff interval', 'progression or tension during setup'],
    applicabilityConditions: 'Applicable when a timed payoff is identifiable and temporal evidence covers the transition.',
    requiredConfidence: 'high', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: visualSemantic, notes: 'Approximately 10–20 seconds is guidance, not a hard threshold.',
  }),
  ENDING_QUALITY: rule({
    ruleId: 'RULE_ENDING_QUALITY', PreViralAspect: 'loopingAndRetention', classification: 'universal',
    principle: 'The actual ending should be intentional, readable, and satisfying for the concept.',
    sources: [source('GENERAL_GUIDELINE', 1, 2), source('LOW_SKIP_CHECKLIST', 4, 5), source('LOW_SKIP_SUMMARY', 2, 3)],
    requiredEvidence: ['actual ending frame', 'ending-tail activity', 'semantic resolution'],
    applicabilityConditions: 'Always assess without requiring a seamless loop.',
    requiredConfidence: 'medium', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: visualSemantic, notes: 'Trailing inactivity is measurable; satisfaction is semantic.',
  }),
  LOOP_AND_REWATCH: rule({
    ruleId: 'RULE_LOOP_AND_REWATCH', PreViralAspect: 'loopingAndRetention', classification: 'conditional',
    principle: 'A loop or another evidence-backed revisit reason can improve retention.',
    sources: [source('GENERAL_GUIDELINE', 2), source('LOW_SKIP_CHECKLIST', 5), source('LOW_SKIP_SUMMARY', 2, 3)],
    requiredEvidence: ['start/end similarity', 'semantic continuity', 'rewatch reason'],
    applicabilityConditions: 'Applicable only when looping or replay serves the concept; a non-loop intentional ending is valid.',
    requiredConfidence: 'medium', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: visualSemantic, notes: 'Start/end similarity is not proof of a seamless loop.',
  }),
  TECHNICAL_CLEANLINESS: rule({
    ruleId: 'RULE_TECHNICAL_CLEANLINESS', PreViralAspect: 'technicalCompliance', classification: 'universal',
    principle: 'Visible technical degradation should not impair comprehension or trust.',
    sources: [source('GENERAL_GUIDELINE', 2, 3), source('LOW_SKIP_CHECKLIST', 6), source('LOW_SKIP_SUMMARY', 2, 3)],
    requiredEvidence: ['dimensions', 'brightness', 'contrast', 'sharpness', 'degradation proxies'],
    applicabilityConditions: 'Score only visible or materially obstructive degradation; exact export presets remain guidance.',
    requiredConfidence: 'high', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: ['measured_local', 'semantic_local', 'semantic_remote'], notes: 'The canonical display name remains Technical & Unconnected Reach.',
  }),
  WATERMARK_FRICTION: rule({
    ruleId: 'RULE_WATERMARK_FRICTION', PreViralAspect: 'technicalCompliance', classification: 'conditional',
    principle: 'A recognizable third-party platform watermark can create presentation and distribution risk.',
    sources: [source('GENERAL_GUIDELINE', 3), source('LOW_SKIP_CHECKLIST', 6), source('LOW_SKIP_SUMMARY', 2)],
    requiredEvidence: ['logo or text detection', 'spatial persistence', 'brand identification'],
    applicabilityConditions: 'Applicable only when a watermark is confidently present and is not part of the depicted subject.',
    requiredConfidence: 'high', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: ['ocr_local', 'semantic_local', 'semantic_remote'], notes: 'Do not claim a quantified suppression effect.',
  }),
  TEXT_PRESENTATION: rule({
    ruleId: 'RULE_TEXT_PRESENTATION', PreViralAspect: 'technicalCompliance', classification: 'conditional',
    principle: 'Used text should be legible, visible long enough, and clear of interface obstruction.',
    sources: [source('GENERAL_GUIDELINE', 3), source('LOW_SKIP_CHECKLIST', 6)],
    requiredEvidence: ['OCR bounds', 'text contrast and duration', 'safe-zone intersection'],
    applicabilityConditions: 'Applicable only when important visible text is present.',
    requiredConfidence: 'high', possibleSeverity: ['minor', 'major'], scoreAffecting: true, feedbackOnly: false,
    allowedProvenance: ['measured_local', 'ocr_local', 'semantic_local', 'semantic_remote'], notes: 'No-text clarity remains valid.',
  }),
  SHAREABILITY_VALUE: rule({
    ruleId: 'RULE_SHAREABILITY_VALUE', PreViralAspect: 'shareabilityEstimate', classification: 'conditional',
    principle: 'Useful, relatable, surprising, impressive, or emotionally resonant content can support sharing.',
    sources: [source('GENERAL_GUIDELINE', 1, 2, 3), source('LOW_SKIP_CHECKLIST', 6), source('LOW_SKIP_SUMMARY', 2, 3)],
    requiredEvidence: ['delivered viewer value', 'concrete sharing reason', 'niche-aware audience interpretation'],
    applicabilityConditions: 'Applicable only when this Reel supplies an observable sharing reason; niche alone is insufficient.',
    requiredConfidence: 'medium', possibleSeverity: ['minor', 'major'], scoreAffecting: false, feedbackOnly: false,
    allowedProvenance: ['semantic_local', 'semantic_remote', 'user_context'], notes: 'Overall-score relationship is deferred to scoring reconciliation.',
  }),
  NONFOLLOWER_ACCESSIBILITY: rule({
    ruleId: 'RULE_NONFOLLOWER_ACCESSIBILITY', PreViralAspect: 'nonFollowerEstimate', classification: 'universal',
    principle: 'A viewer unfamiliar with the creator should have an evidence-backed reason to understand or continue.',
    sources: [source('GENERAL_GUIDELINE', 1, 2), source('LOW_SKIP_CHECKLIST', 2, 6), source('LOW_SKIP_SUMMARY', 1, 2)],
    requiredEvidence: ['opening clarity', 'subject identification', 'selected niche context'],
    applicabilityConditions: 'Always considered without requiring an explicit niche label in frame one.',
    requiredConfidence: 'medium', possibleSeverity: ['minor', 'major'], scoreAffecting: false, feedbackOnly: false,
    allowedProvenance: ['ocr_local', 'transcript_local', 'semantic_local', 'semantic_remote', 'user_context'], notes: 'Current effect is limited to the optional non-follower estimate.',
  }),
  CTA_CONVERSION: rule({
    ruleId: 'RULE_CTA_CONVERSION', PreViralAspect: 'conversionEstimate', classification: 'advisory',
    principle: 'A specific value-based CTA may improve follow or comment intent when it fits the concept.',
    sources: [source('GENERAL_GUIDELINE', 2)],
    requiredEvidence: ['existing CTA when present', 'delivered value', 'semantic fit'],
    applicabilityConditions: 'Offer only when a CTA naturally supports the concept; never require one or invent a future promise.',
    requiredConfidence: 'medium', possibleSeverity: ['minor'], scoreAffecting: false, feedbackOnly: true,
    allowedProvenance: ['ocr_local', 'transcript_local', 'semantic_local', 'semantic_remote', 'user_context'], notes: 'Missing CTA is not a retention defect.',
  }),
});

export type RuleFamily = keyof typeof RULE_FAMILIES;

export const STRICT_SOURCE_EXCEPTIONS: ReadonlyArray<{
  id: string;
  ruleFamilies: RuleFamily[];
  evidence: string;
  expected: string;
  automaticPenalty: false;
}> = Object.freeze([
  { id: 'compelling-static-opening', ruleFamilies: ['OPENING_VISUAL_STRENGTH'], evidence: 'A still first image has supported beauty, tension, novelty, or intrigue.', expected: 'Low opening motion remains a measurement and does not activate a weakness by itself.', automaticPenalty: false },
  { id: 'deliberate-silence', ruleFamilies: ['OPENING_AUDIO_SUPPORT', 'DEAD_TIME'], evidence: 'Silence is observed and semantically supported as intentional.', expected: 'Silence is not treated as dead air or a failed audio hook.', automaticPenalty: false },
  { id: 'single-shot-meaningful-progression', ruleFamilies: ['PACING_PROGRESS', 'NARRATIVE_PROGRESS'], evidence: 'One shot contains supported action, tension, lighting, or informational development.', expected: 'A single shot can receive strong progression judgments.', automaticPenalty: false },
  { id: 'no-text-clarity', ruleFamilies: ['OPENING_TEXT_SUPPORT', 'TEXT_PRESENTATION'], evidence: 'The visual subject and purpose are clear without overlays.', expected: 'Text support is not applicable and absence of text has no penalty.', automaticPenalty: false },
  { id: 'long-shot-with-continued-value', ruleFamilies: ['PACING_PROGRESS', 'DEAD_TIME'], evidence: 'A long shot continues to add or intentionally sustain viewer value.', expected: 'Shot duration alone does not activate pacing or dead-time weakness.', automaticPenalty: false },
  { id: 'non-loop-intentional-ending', ruleFamilies: ['ENDING_QUALITY', 'LOOP_AND_REWATCH'], evidence: 'The ending resolves the concept without matching the opening.', expected: 'Looping is not applicable and the intentional ending remains valid.', automaticPenalty: false },
  { id: 'slow-but-escalating-payoff', ruleFamilies: ['PAYOFF_TIMING', 'PAYOFF_DELIVERY'], evidence: 'Setup exceeds a suggested duration while tension or value continues increasing.', expected: 'Elapsed time alone does not mark the payoff late.', automaticPenalty: false },
  { id: 'visually-similar-semantically-useful', ruleFamilies: ['REDUNDANT_VISUALS'], evidence: 'Similar compositions support comparison, emphasis, rhythm, or visible development.', expected: 'Similarity candidates do not become redundant-footage penalties.', automaticPenalty: false },
  { id: 'rapid-cutting-without-meaningful-progression', ruleFamilies: ['PACING_PROGRESS'], evidence: 'Frequent cuts repeat the same semantic information.', expected: 'High visual-change frequency does not create a positive pacing judgment.', automaticPenalty: false },
]);
