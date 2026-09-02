import { getPresetReels } from './data/presets';
import type { ReelEvaluation } from './types';

type AuditInput = {
  title: string;
  durationSeconds: number;
  fileFormat: string;
  fileSizeMb: number;
  niche: string;
  captionInput: string;
  videoConcept: string;
  audioType: string;
  videoContentHash?: string;
  videoMetrics?: VideoMetrics;
  language: 'en' | 'ko';
};

export type VideoMetrics = {
  width: number;
  height: number;
  motionScore: number;
  contrastScore: number;
  brightnessScore: number;
  loopSimilarityScore: number;
  sampledFrames: number;
};

export function createLocalEvaluation(input: AuditInput): ReelEvaluation {
  const base = structuredClone(getPresetReels(input.language)[0].preComputedEvaluation);
  const missingCaption = !input.captionInput.trim();
  const missingConcept = !input.videoConcept.trim();
  const isKo = input.language === 'ko';
  const metrics = input.videoMetrics;

  // Browser-only fallback: score only signals that are actually available.
  // Unknown visual/audio qualities receive neutral-conservative values rather
  // than invented positive observations.
  const motionFactor = metrics ? metrics.motionScore / 100 : 0.4;
  const contrastFactor = metrics ? metrics.contrastScore / 100 : 0.4;
  const hookStars = Number(Math.max(1, Math.min(5, 1.4 + motionFactor * 2.3 + contrastFactor * 0.7 + (missingCaption ? -0.5 : 0.4))).toFixed(1));
  const durationPenalty = input.durationSeconds <= 15 ? 0 : input.durationSeconds <= 25 ? 0.3 : 0.7;
  const pacingStars = Number(Math.max(1, Math.min(5, 1.8 + motionFactor * 2.3 - durationPenalty)).toFixed(1));
  const narrativeStars = Number(Math.max(1, Math.min(5, 2.0 + contrastFactor * 0.8 + (missingConcept ? 0 : 0.7))).toFixed(1));
  const loopStars = Number(Math.max(1, Math.min(5, 1.5 + (metrics?.loopSimilarityScore ?? 40) / 100 * 3)).toFixed(1));
  const resolutionPoints = metrics ? (metrics.width >= 1080 && metrics.height >= 1080 ? 1.2 : metrics.width >= 720 ? 0.7 : 0.2) : 0.4;
  const portraitPoints = metrics && metrics.height > metrics.width ? 0.7 : 0.2;
  const techStars = Number(Math.max(1, Math.min(5, 2.0 + resolutionPoints + portraitPoints + (missingCaption ? 0 : 0.4))).toFixed(1));
  const stars = Number((hookStars * 0.3 + pacingStars * 0.25 + narrativeStars * 0.2 + loopStars * 0.15 + techStars * 0.1).toFixed(1));
  const verdict = stars >= 4.2 ? 'Viral Contender' : stars >= 3.5 ? 'Strong Growth' : stars >= 2.8 ? 'Moderate Retention' : 'High Skip Risk';
  const evidenceLimit = metrics
    ? (isKo
        ? `${metrics.sampledFrames}개 프레임에서 측정한 움직임·대비·밝기와 영상 메타데이터를 기준으로 평가했습니다.`
        : `Scored from motion, contrast, brightness, and metadata measured across ${metrics.sampledFrames} sampled frames.`)
    : (isKo
        ? '브라우저에서 직접 검증되지 않은 항목은 보수적인 중립 점수로 처리했습니다.'
        : 'Signals not directly verified in the browser were scored conservatively as unknown.');

  return {
    ...base,
    id: `eval-${Date.now()}`,
    title: input.title,
    durationSeconds: input.durationSeconds,
    fileFormat: input.fileFormat,
    fileSizeMb: input.fileSizeMb,
    niche: input.niche,
    captionInput: input.captionInput,
    videoConcept: input.videoConcept,
    audioType: input.audioType,
    timestamp: new Date().toISOString(),
    overallStars: stars,
    overallScorePercent: Math.round(stars * 20),
    overallVerdict: verdict,
    expectedSkipRatePercent: Math.min(65, Math.max(12, Math.round(50 - stars * 7))),
    followerGrowthPotentialPercent: Math.round(stars * 18 + 5),
    nonFollowerInterestStars: Number((stars * 0.95).toFixed(1)),
    shareabilitySendScore: Math.round(stars * 18.5),
    criticalDefectsIdentified: [
      ...(missingCaption
        ? [isKo ? '화면 자막 훅과 게시용 캡션이 입력되지 않아 텍스트 훅을 검증할 수 없습니다.' : 'No on-screen hook or caption was supplied, so text-hook effectiveness cannot be verified.']
        : []),
      ...(missingConcept
        ? [isKo ? '기획 의도가 입력되지 않아 스토리 구조를 의도와 대조할 수 없습니다.' : 'No creative intent was supplied, so the narrative cannot be checked against its intended outcome.']
        : []),
      evidenceLimit,
    ],
    aspects: {
      ...base.aspects,
      hookStrength: {
        ...base.aspects.hookStrength,
        stars: hookStars,
        visualHook: metrics
          ? (isKo ? `샘플 프레임 움직임 ${metrics.motionScore}/100, 대비 ${metrics.contrastScore}/100.` : `Sampled-frame motion ${metrics.motionScore}/100; contrast ${metrics.contrastScore}/100.`)
          : (isKo ? '현재 브라우저 분석에서 직접 검증되지 않음.' : 'Not directly verified in the current browser analysis.'),
        textHook: missingCaption
          ? (isKo ? '입력 없음: 텍스트 훅을 평가할 수 없습니다.' : 'Not supplied: text-hook quality cannot be evaluated.')
          : (isKo ? '입력된 캡션을 기준으로만 평가했습니다.' : 'Evaluated only from the supplied caption text.'),
        audioHook: isKo ? '현재 브라우저 분석에서 직접 검증되지 않음.' : 'Not directly verified in the current browser analysis.',
        verdict: evidenceLimit,
      },
      pacingAndStimulation: {
        ...base.aspects.pacingAndStimulation,
        stars: pacingStars,
        avgCutFrequencySec: metrics ? Number((input.durationSeconds / Math.max(1, metrics.sampledFrames - 1)).toFixed(1)) : 0,
        deadAirDetectedSec: 0,
        patternInterruptsCount: 0,
        verdict: metrics
          ? (isKo ? `프레임 간 시각 변화량 ${metrics.motionScore}/100, 재생 시간 ${input.durationSeconds}초 기준.` : `Frame-to-frame visual change ${metrics.motionScore}/100 across a ${input.durationSeconds}s video.`)
          : (isKo ? `재생 시간 ${input.durationSeconds}초만 확인됨.` : `Only the ${input.durationSeconds}s duration was verified.`),
      },
      narrativeAndPayoff: {
        ...base.aspects.narrativeAndPayoff,
        stars: narrativeStars,
        setupDurationSec: 0,
        payoffTimingSec: 0,
        verdict: missingConcept
          ? (isKo ? '기획 의도가 없어 서사 목표를 검증할 수 없음.' : 'Narrative intent was not supplied, so payoff alignment cannot be verified.')
          : (isKo ? '입력된 기획 의도만 기준으로 평가함. 실제 전개 시점은 미검증.' : 'Scored from the stated intent only; actual story timing was not verified.'),
      },
      loopingAndRetention: {
        ...base.aspects.loopingAndRetention,
        stars: loopStars,
        seamlessLoopScore: metrics?.loopSimilarityScore ?? 50,
        rewatchTriggerPresent: (metrics?.loopSimilarityScore ?? 0) >= 70,
        verdict: metrics
          ? (isKo ? `첫·마지막 샘플 프레임 유사도 ${metrics.loopSimilarityScore}/100.` : `First/last sampled-frame similarity ${metrics.loopSimilarityScore}/100.`)
          : (isKo ? '영상의 시작·끝 연결은 현재 분석에서 검증되지 않음.' : 'Start/end continuity was not verified in the current analysis.'),
      },
      technicalCompliance: {
        ...base.aspects.technicalCompliance,
        stars: techStars,
        watermarkDetected: false,
        resolutionText: metrics ? `${metrics.width} × ${metrics.height}` : (isKo ? '해상도 미검증' : 'Resolution not verified'),
        safeZoneViolation: false,
        captionQuality: missingCaption ? (isKo ? '입력 없음' : 'Not supplied') : (isKo ? '입력 텍스트만 확인' : 'Supplied text only'),
        verdict: metrics
          ? (isKo ? `${input.fileFormat}, ${metrics.width}×${metrics.height}, ${metrics.height > metrics.width ? '세로형' : '가로형'} 영상.` : `${input.fileFormat}, ${metrics.width}×${metrics.height}, ${metrics.height > metrics.width ? 'portrait' : 'landscape'} video.`)
          : (isKo ? `${input.fileFormat} 형식만 확인됨.` : `Only the ${input.fileFormat} format was verified.`),
      },
    },
  };
}

export function createLocalCaptions(topic: string, niche: string, language: string) {
  if (language === 'ko') {
    return {
      hooks: [`멈춰서 보세요: ${topic}의 핵심은 바로 이것입니다 🔥`, `${topic}, 아직도 이렇게 하고 계신가요?`, `30일 동안 직접 검증한 ${topic}의 결과 👇`],
      valueCTA: `${niche} 성장 전략을 더 보고 싶다면 팔로우하세요!`,
      cliffhangerCTA: '다음 릴스에서 전체 과정을 공개합니다—저장하고 기다려주세요!',
      commentBaitQuestion: '어떤 방법을 먼저 적용해보고 싶으신가요?',
      hashtags: ['#릴스성장', '#콘텐츠크리에이터', '#바이럴릴스', '#인스타그램팁', '#크리에이터노하우'],
    };
  }
  return {
    hooks: [`Stop scrolling: this changes how you approach ${topic} 🔥`, `Are you still making this ${topic} mistake?`, `I tested this ${topic} approach so you don't have to 👇`],
    valueCTA: `Follow for more practical ${niche} growth strategies!`,
    cliffhangerCTA: 'I’ll reveal the full process in the next Reel—save this and follow along!',
    commentBaitQuestion: 'Which change would you try first?',
    hashtags: ['#reelsgrowth', '#contentcreator', '#viralreels', '#instagramtips', '#creatortips'],
  };
}
