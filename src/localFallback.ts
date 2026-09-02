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
  language: 'en' | 'ko';
};

export function createLocalEvaluation(input: AuditInput): ReelEvaluation {
  const base = structuredClone(getPresetReels(input.language)[0].preComputedEvaluation);
  const missingCaption = !input.captionInput.trim();
  const missingConcept = !input.videoConcept.trim();
  const isKo = input.language === 'ko';

  // Browser-only fallback: score only signals that are actually available.
  // Unknown visual/audio qualities receive neutral-conservative values rather
  // than invented positive observations.
  const hookStars = missingCaption ? 1.8 : 3.0;
  const pacingStars = input.durationSeconds <= 15 ? 3.0 : input.durationSeconds <= 25 ? 2.7 : 2.2;
  const narrativeStars = missingConcept ? 2.0 : 3.0;
  const loopStars = 2.5;
  const techStars = ['MP4', 'MOV', 'WEBM'].includes(input.fileFormat.toUpperCase()) ? 2.8 : 2.4;
  const stars = Number((hookStars * 0.3 + pacingStars * 0.25 + narrativeStars * 0.2 + loopStars * 0.15 + techStars * 0.1).toFixed(1));
  const verdict = stars >= 4.2 ? 'Viral Contender' : stars >= 3.5 ? 'Strong Growth' : stars >= 2.8 ? 'Moderate Retention' : 'High Skip Risk';
  const evidenceLimit = isKo
    ? '브라우저 분석에서 직접 검증되지 않은 시각·오디오 항목은 보수적인 중립 점수로 처리했습니다.'
    : 'Visual and audio signals not directly verified in the browser were scored conservatively as unknown.';

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
        visualHook: isKo ? '현재 브라우저 분석에서 직접 검증되지 않음.' : 'Not directly verified in the current browser analysis.',
        textHook: missingCaption
          ? (isKo ? '입력 없음: 텍스트 훅을 평가할 수 없습니다.' : 'Not supplied: text-hook quality cannot be evaluated.')
          : (isKo ? '입력된 캡션을 기준으로만 평가했습니다.' : 'Evaluated only from the supplied caption text.'),
        audioHook: isKo ? '현재 브라우저 분석에서 직접 검증되지 않음.' : 'Not directly verified in the current browser analysis.',
        verdict: evidenceLimit,
      },
      pacingAndStimulation: {
        ...base.aspects.pacingAndStimulation,
        stars: pacingStars,
        avgCutFrequencySec: 0,
        deadAirDetectedSec: 0,
        patternInterruptsCount: 0,
        verdict: isKo
          ? `재생 시간 ${input.durationSeconds}초만 확인됨. 컷 전환과 정적 구간은 검증되지 않음.`
          : `Only the ${input.durationSeconds}s duration was verified; cuts and dead-air intervals were not measured.`,
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
        seamlessLoopScore: 50,
        rewatchTriggerPresent: false,
        verdict: isKo ? '영상의 시작·끝 연결은 현재 분석에서 검증되지 않음.' : 'Start/end continuity was not verified in the current analysis.',
      },
      technicalCompliance: {
        ...base.aspects.technicalCompliance,
        stars: techStars,
        watermarkDetected: false,
        resolutionText: isKo ? '해상도 미검증' : 'Resolution not verified',
        safeZoneViolation: false,
        captionQuality: missingCaption ? (isKo ? '입력 없음' : 'Not supplied') : (isKo ? '입력 텍스트만 확인' : 'Supplied text only'),
        verdict: isKo
          ? `${input.fileFormat} 형식과 파일 메타데이터만 확인됨. 워터마크·해상도·안전지대는 미검증.`
          : `Only ${input.fileFormat} and file metadata were verified; watermark, resolution, and safe zones were not measured.`,
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
