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
  language: 'en' | 'ko';
};

export function createLocalEvaluation(input: AuditInput): ReelEvaluation {
  const base = structuredClone(getPresetReels(input.language)[0].preComputedEvaluation);
  const missingCaption = !input.captionInput.trim();
  const longVideo = input.durationSeconds > 25;
  const adjustment = (missingCaption ? 0.7 : 0) + (longVideo ? 0.4 : 0);
  const stars = Number(Math.max(1, base.overallStars - adjustment).toFixed(1));
  const verdict = stars >= 4.2 ? 'Viral Contender' : stars >= 3.5 ? 'Strong Growth' : stars >= 2.8 ? 'Moderate Retention' : 'High Skip Risk';

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
    criticalDefectsIdentified: missingCaption
      ? [input.language === 'ko' ? '화면 자막 훅과 게시용 캡션이 없어 초기 이탈 위험이 높습니다.' : 'No on-screen text hook or caption was supplied, increasing early skip risk.']
      : base.criticalDefectsIdentified,
    aspects: {
      ...base.aspects,
      hookStrength: {
        ...base.aspects.hookStrength,
        stars: Number(Math.max(1, base.aspects.hookStrength.stars - (missingCaption ? 1.1 : 0)).toFixed(1)),
        textHook: missingCaption
          ? (input.language === 'ko' ? '누락: 화면 자막 훅이 입력되지 않았습니다.' : 'Missing: no on-screen text hook was supplied.')
          : base.aspects.hookStrength.textHook,
      },
      pacingAndStimulation: {
        ...base.aspects.pacingAndStimulation,
        stars: Number(Math.max(1, base.aspects.pacingAndStimulation.stars - (longVideo ? 0.8 : 0)).toFixed(1)),
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
