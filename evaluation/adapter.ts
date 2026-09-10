import type { ReelEvaluation } from '../src/types';
import type { EvaluationRequest, Observations, Feedback, ScoreResult, GroundedContext } from './contracts';

export function adaptEvaluation(request: EvaluationRequest, o: Observations, s: ScoreResult, f: Feedback, id: string, transcriptAvailable: boolean, context: GroundedContext): ReelEvaluation {
  const ko = request.language === 'ko';
  const a = s.aspectScores;
  const notVerified = ko ? '확인할 수 없습니다.' : 'Not verified.';
  const verdict = (...keys: Array<keyof Observations['traits']>) => keys.map(k => o.traits[k].reason).join(' ');
  const limits = [...o.limitations, ko ? '전체 영상의 순서대로 추출한 화면과 사용 가능한 음성 전사로 검토했습니다. 화면 사이의 짧은 동작과 음악·효과음은 완전히 확인하지 못할 수 있습니다.' : 'Reviewed ordered images across the Reel and available speech transcription. Brief actions between images and music or sound effects may not be fully understood.'];
  if (!transcriptAvailable) limits.push(ko ? '음성 내용은 확인하지 못했습니다.' : 'Spoken content was not verified.');
  return {
    id, title: request.title, durationSeconds: request.evidence.durationSeconds, fileFormat: request.fileFormat, fileSizeMb: request.fileSizeMb,
    niche: request.niche, captionInput: request.captionInput, videoConcept: request.videoConcept, audioType: request.audioType, timestamp: new Date().toISOString(),
    evaluatorVersion: s.version, prediction: s.skipEstimate, conversionIndex: s.conversionIndex,
    grounding: context.grounding, aspectEvidence: context.aspectContext,
    executiveSummary: f.summary, observedStrengths: f.strengths, observedWeaknesses: f.weaknesses,
    evidenceSummary: { sampledFrames: request.evidence.frames.length, analysisMode: 'multimodal', audioVerified: false, transcriptAvailable, limitations: [...limits, ...(request.evidence.audioUnavailableReason ? [request.evidence.audioUnavailableReason] : [])] },
    overallStars: s.overallStars, overallScorePercent: s.overallScorePercent, overallVerdict: s.verdict,
    expectedSkipRatePercent: s.skipEstimate.midpoint, followerGrowthPotentialPercent: s.conversionIndex, nonFollowerInterestStars: s.nonFollowerInterestStars, shareabilitySendScore: s.shareabilityIndex,
    aspects: {
      hookStrength: { stars: a.hookStrength, label: 'Zero-Second Hook', visualHook: f.aspectNotes.hookStrength.detail, textHook: f.textObservation, audioHook: f.audioObservation, verdict: f.aspectNotes.hookStrength.verdict },
      pacingAndStimulation: { stars: a.pacingAndStimulation, label: 'Pacing & Pattern Interrupts', avgCutFrequencySec: null, deadAirDetectedSec: null, patternInterruptsCount: null, verdict: f.aspectNotes.pacingAndStimulation.verdict },
      narrativeAndPayoff: { stars: a.narrativeAndPayoff, label: 'Narrative Arc & Payoff', setupDurationSec: null, payoffTimingSec: null, verdict: f.aspectNotes.narrativeAndPayoff.verdict },
      loopingAndRetention: { stars: a.loopingAndRetention, label: 'Loopability & Retention', seamlessLoopScore: null, rewatchTriggerPresent: null, verdict: f.aspectNotes.loopingAndRetention.verdict },
      technicalCompliance: { stars: a.technicalCompliance, label: 'Technical Compliance & Safe Zone', watermarkDetected: o.watermark === 'unknown' ? null : o.watermark === 'present', resolutionText: `${request.evidence.width} × ${request.evidence.height}`, safeZoneViolation: o.safeZone === 'unknown' ? null : o.safeZone === 'violation', captionQuality: f.textObservation || notVerified, verdict: f.aspectNotes.technicalCompliance.verdict },
    },
    actionableEdits: f.edits.map(edit => ({ id: edit.id, timestampRange: edit.sceneIds.map(id => o.scenes.find(scene => scene.id === id)!.description).join(' → '), type: edit.weaknessId ? ({ hookStrength: 'hook', pacingAndStimulation: 'pacing', narrativeAndPayoff: 'payoff', loopingAndRetention: 'cut', technicalCompliance: 'safezone' } as const)[o.weaknesses.find(w => w.id === edit.weaknessId)!.aspect] : 'cut', severity: edit.priority === 'must_fix' ? 'critical' : edit.priority === 'should_improve' ? 'recommended' : 'optional', issue: edit.problem, solution: edit.editThis })),
    editPlan: f, captionOptimization: { recommendedHooks: f.captionHooks, valueCTA: f.valueCTA, cliffhangerCTA: f.cliffhangerCTA, commentBaitQuestion: f.commentQuestion, targetHashtags: f.hashtags },
    criticalDefectsIdentified: f.edits.filter(e => e.priority === 'must_fix').map(e => e.problem), isCachedEvaluation: false,
  };
}
