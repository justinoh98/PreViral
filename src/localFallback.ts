import type { ReelEvaluation } from './types';

type AuditInput = {
  title: string; durationSeconds: number; fileFormat: string; fileSizeMb: number;
  niche: string; captionInput: string; videoConcept: string; audioType: string;
  videoContentHash?: string; videoMetrics?: VideoMetrics; audioMetrics?: AudioMetrics; language: 'en' | 'ko';
};

export type AudioMetrics = {
  verified: boolean; initialSilenceDurationSec: number; openingEnergyScore: number;
  averageEnergyScore: number; dynamicRangeScore: number; loopEnergySimilarityScore: number;
  strongestAudioChangeTimeSec: number; timelineSamples: Array<{ timeSec: number; energy: number }>;
};

export type VideoMetrics = {
  width: number; height: number; motionScore: number; contrastScore: number;
  brightnessScore: number; loopSimilarityScore: number; earlyMotionScore: number;
  changeFrequencyScore: number; payoffChangeScore: number; sceneCutScore: number;
  staticFrameRatio: number; sharpnessScore: number; colorfulnessScore: number;
  exposureStabilityScore: number; blackFrameRatio: number; sampledFrames: number;
  strongestChangeTimeSec: number; strongestOpeningChangeTimeSec: number;
  longestStaticStartSec: number; longestStaticEndSec: number; longestStaticDurationSec: number;
  detectedCutTimesSec: number[];
  timelineSamples: Array<{ timeSec: number; motion: number; brightness: number; contrast: number; sharpness: number; colorfulness: number }>;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const oneDecimal = (value: number) => Number(value.toFixed(1));

export function createLocalEvaluation(input: AuditInput): ReelEvaluation {
  const metrics = input.videoMetrics;
  const audio = input.audioMetrics?.verified ? input.audioMetrics : undefined;
  const ko = input.language === 'ko';
  const subject = input.videoConcept.trim() || input.niche.trim() || (ko ? '이 장면' : 'this scene');
  const hasCaption = Boolean(input.captionInput.trim());
  const value = (score: number | undefined, fallback = 38) => (score ?? fallback) / 100;

  // Measurements choose the private rating signal. Creator-facing feedback below
  // describes visible qualities and practical changes, never raw scan values.
  let hook = 1.1 + value(metrics?.earlyMotionScore) * 2.6 + value(metrics?.contrastScore) * .55 + value(metrics?.sharpnessScore) * .35;
  if (audio) hook += (audio.openingEnergyScore / 100 - .35) * .6;
  if (audio && audio.initialSilenceDurationSec > .3) hook -= .7;
  let pacing = 1.15 + value(metrics?.changeFrequencyScore) * 1.75 + value(metrics?.motionScore) * .75 + value(metrics?.sceneCutScore) * .55 - value(metrics?.staticFrameRatio) * .5;
  let payoff = 1.2 + value(metrics?.payoffChangeScore) * 2.25 + value(metrics?.changeFrequencyScore) * .5;
  let loop = .9 + value(metrics?.loopSimilarityScore) * 3.15;
  let technical = 1.1 + (metrics && metrics.height > metrics.width ? .8 : .2) + value(metrics?.sharpnessScore) * 1.45 + value(metrics?.exposureStabilityScore) * .65 + value(metrics?.colorfulnessScore) * .25;

  hook = oneDecimal(clamp(hook, 0, 5));
  pacing = oneDecimal(clamp(pacing, 0, 5));
  payoff = oneDecimal(clamp(payoff, 0, 5));
  loop = oneDecimal(clamp(loop, 0, 5));
  technical = oneDecimal(clamp(technical, 0, 5));
  const overallStars = oneDecimal(clamp(hook * .3 + pacing * .25 + payoff * .2 + loop * .15 + technical * .1, 0, 5));
  const overallVerdict: ReelEvaluation['overallVerdict'] = overallStars >= 4.2
    ? 'Viral Contender' : overallStars >= 3.5 ? 'Strong Growth' : overallStars >= 2.8 ? 'Moderate Retention' : 'High Skip Risk';
  const expectedSkipRatePercent = overallStars >= 4.2
    ? clamp(Math.round(27 - overallStars * 3), 5, 14)
    : overallStars >= 3.5 ? clamp(Math.round(52 - overallStars * 8), 15, 29)
      : overallStars >= 2.8 ? clamp(Math.round(69 - overallStars * 10), 30, 45)
        : clamp(Math.round(75 - overallStars * 8), 46, 80);

  const openingIsStrong = hook >= 3.6;
  const pacingIsStrong = pacing >= 3.5;
  const payoffIsStrong = payoff >= 3.5;
  const loopIsStrong = loop >= 3.5;
  const pictureIsStrong = technical >= 3.5;

  const strengths = [
    openingIsStrong
      ? (ko ? '첫 장면에 바로 시선이 가는 움직임과 대비가 있어 스크롤을 멈출 이유가 보입니다.' : 'The opening has enough motion and contrast to give viewers a reason to stop scrolling.')
      : (ko ? '피사체와 배경이 구분되어 무엇을 봐야 하는지는 비교적 분명합니다.' : 'The subject is distinct enough from the background to keep the visual focus understandable.'),
    payoffIsStrong
      ? (ko ? '후반부의 모습이 앞 장면과 다르게 보여 결과를 기다린 보람이 있습니다.' : 'The later visual feels meaningfully different from what came before, so the payoff feels earned.')
      : (ko ? '영상의 핵심 소재가 일관되어 메시지가 다른 방향으로 새지 않습니다.' : 'The central subject remains consistent, so the visual message does not wander.'),
  ];
  const weaknesses = [
    openingIsStrong
      ? (ko ? '강한 첫 이미지를 설명하는 짧은 문구가 더해지면 낯선 시청자도 맥락을 바로 이해할 수 있습니다.' : 'A short line explaining the strong opening image would help unfamiliar viewers understand it immediately.')
      : (ko ? '첫 장면이 결과보다 과정처럼 보여, 처음 보는 사람에게는 계속 볼 이유가 늦게 생깁니다.' : 'The first shot reads more like setup than payoff, so a new viewer gets the reason to keep watching too late.'),
    pacingIsStrong
      ? (ko ? '장면 변화는 살아 있지만 각 변화가 같은 정보를 반복하지 않도록 문구의 역할을 나눌 필요가 있습니다.' : 'The visual changes feel active, but each one needs a distinct message so the Reel does not repeat itself.')
      : (ko ? '중간 구간의 화면이 오래 비슷하게 유지되어 내용이 끝나기 전에 결론을 예상하게 만듭니다.' : 'The middle stays visually similar for too long, letting viewers predict the ending before it arrives.'),
    payoffIsStrong
      ? (ko ? '마지막 결과를 한 번 더 또렷하게 정리하면 저장하거나 공유할 이유가 강해집니다.' : 'A clearer final takeaway would give viewers a stronger reason to save or share it.')
      : (ko ? '마지막 장면이 시작의 약속을 크게 확장하지 않아 결말이 지나가는 느낌입니다.' : 'The ending does not expand enough on the opening promise, so the payoff feels easy to miss.'),
  ];
  const executiveSummary = overallStars >= 3.5
    ? (ko
      ? '영상의 중심 소재는 분명하고 화면 흐름도 기본적으로 이해됩니다. 더 넓은 비팔로워에게 닿으려면 첫 화면에서 왜 봐야 하는지를 문장으로 못 박고, 중간 장면마다 새로운 의미를 주며, 마지막 결과를 저장할 만한 한 문장으로 끝내세요.'
      : 'The Reel has a clear visual subject and an understandable flow. To reach more non-followers, state why the opening matters, give every middle shot a new job, and finish with one takeaway worth saving.')
    : (ko
      ? '현재 편집은 무엇을 보여주는지는 알 수 있지만, 처음 보는 사람이 끝까지 볼 이유가 충분히 선명하지 않습니다. 결과 장면을 앞으로 당기고, 비슷한 중간 화면을 줄이며, 각 장면에 짧고 자연스러운 문맥을 붙이면 훨씬 더 강해집니다.'
      : 'The edit shows what is happening, but it does not yet give a first-time viewer a strong reason to stay. Lead with the result, remove repetitive middle visuals, and give each remaining shot a short, natural line of context.');

  const edits: ReelEvaluation['actionableEdits'] = [
    {
      id: 'opening-context', timestampRange: ko ? '첫 장면' : 'Opening shot', type: 'hook', severity: openingIsStrong ? 'recommended' : 'critical',
      issue: openingIsStrong ? (ko ? '화면은 눈에 띄지만 처음 보는 사람에게 의미가 바로 설명되지는 않습니다.' : 'The image catches attention, but its meaning is not immediate to a first-time viewer.') : (ko ? '과정부터 시작해 가장 매력적인 결과가 뒤로 숨습니다.' : 'The edit begins with process footage while the most compelling result stays hidden.'),
      solution: openingIsStrong ? (ko ? `첫 화면에 “${subject}, 여기서 완전히 달라집니다”처럼 장면의 의미를 바로 알려주는 한 줄을 넣으세요.` : `Add one line that explains the image immediately, such as “This is where ${subject} completely changes.”`) : (ko ? `완성된 모습이나 가장 놀라운 장면을 먼저 보여주고 “${subject}, 이렇게 바뀌었습니다”를 겹쳐 쓰세요.` : `Open on the finished result or most surprising image and overlay “Here’s how ${subject} changed.”`),
    },
    {
      id: 'middle-progression', timestampRange: ko ? '중간 흐름' : 'Middle sequence', type: 'pacing', severity: pacingIsStrong ? 'optional' : 'recommended',
      issue: pacingIsStrong ? (ko ? '빠른 장면 변화가 있지만 일부 컷이 같은 메시지를 반복할 수 있습니다.' : 'The edit moves quickly, but some shots can still repeat the same message.') : (ko ? '비슷한 구도와 행동이 이어져 화면이 멈춘 것처럼 느껴집니다.' : 'Similar framing and actions repeat, making the middle feel visually stalled.'),
      solution: ko ? '같은 정보를 보여주는 장면은 하나만 남기고, 나머지는 가까운 디테일·손의 동작·완성 모습처럼 서로 다른 정보를 보여주는 화면으로 바꾸세요.' : 'Keep only one shot for each idea, then replace repetitions with a close detail, a clear hand action, or a wider view of the finished result.',
    },
    {
      id: 'payoff-clarity', timestampRange: ko ? '마지막 장면' : 'Final shot', type: 'payoff', severity: payoffIsStrong ? 'recommended' : 'critical',
      issue: payoffIsStrong ? (ko ? '결과는 보이지만 시청자가 기억할 문장이 남지 않습니다.' : 'The result is visible, but there is no final line for viewers to remember.') : (ko ? '결말이 과정과 충분히 다르게 보이지 않아 완성감이 약합니다.' : 'The ending does not look different enough from the process, weakening the sense of completion.'),
      solution: payoffIsStrong ? (ko ? `결과 화면 위에 “${subject}, 핵심은 이것입니다”처럼 한 문장으로 요점을 남기세요.` : `Leave one takeaway over the result, such as “This is what matters most about ${subject}.”`) : (ko ? `마지막에는 가장 깨끗한 완성 화면만 남기고 “${subject}, 전과 후의 차이”처럼 변화가 무엇인지 분명히 적으세요.` : `End on the cleanest finished view and state the change clearly, such as “${subject}: the difference before and after.”`),
    },
    {
      id: 'visual-polish', timestampRange: ko ? '전체 화면' : 'Whole Reel', type: 'safezone', severity: pictureIsStrong ? 'optional' : 'recommended',
      issue: pictureIsStrong ? (ko ? '전체 화면은 읽기 쉽지만 자막이 피사체와 경쟁하지 않도록 여백을 지켜야 합니다.' : 'The picture is readable, but text still needs breathing room so it does not compete with the subject.') : (ko ? '일부 화면에서 피사체의 디테일이나 밝기가 일정하지 않아 완성도가 떨어져 보입니다.' : 'Some shots lose subject detail or consistent brightness, making the Reel feel less polished.'),
      solution: ko ? '자막은 얼굴과 핵심 물체를 가리지 않는 빈 공간에 두고, 흐리거나 어두운 장면만 따로 보정하세요. 모든 장면에 같은 강한 보정을 씌우지 마세요.' : 'Place text in open space away from faces and key objects, then correct only the soft or dark shots instead of applying one heavy grade to everything.',
    },
  ];
  if (!loopIsStrong) edits.push({
    id: 'loop', timestampRange: ko ? '끝과 시작' : 'Ending into opening', type: 'cut', severity: 'recommended',
    issue: ko ? '끝 장면과 첫 장면의 구도가 달라 반복 재생이 새로 시작된 것처럼 느껴집니다.' : 'The ending composition differs from the opening, so the replay feels like a restart.',
    solution: ko ? '마지막 화면의 피사체 위치와 시선 방향을 첫 화면과 비슷하게 맞춰 자연스럽게 다시 시작되도록 만드세요.' : 'Match the subject position and direction of attention in the final and opening shots so the replay feels continuous.',
  });

  const captions: ReelEvaluation['captionOptimization'] = ko ? {
    recommendedHooks: [`${subject}, 결과가 이렇게 달라졌습니다`, `${subject}에서 대부분 놓치는 한 가지`, `평범했던 ${subject}를 이렇게 바꿨습니다`],
    valueCTA: '나중에 다시 볼 수 있게 저장해 두세요.',
    cliffhangerCTA: '다음에는 이 결과를 더 깔끔하게 만드는 방법을 보여드릴게요.',
    commentBaitQuestion: '여러분이라면 어떤 부분을 먼저 바꾸시겠어요?',
    targetHashtags: ['#릴스제작', '#숏폼콘텐츠', '#영상편집', `#${input.niche.replace(/[^\p{L}\p{N}]/gu, '') || '콘텐츠'}`, '#크리에이터팁'],
  } : {
    recommendedHooks: [`Here’s how ${subject} turned out`, `The one thing most people miss about ${subject}`, `I changed ordinary ${subject} into this`],
    valueCTA: 'Save this so you can use it on your next edit.',
    cliffhangerCTA: 'Next, I’ll show you how to make this result look even cleaner.',
    commentBaitQuestion: 'What would you change first?',
    targetHashtags: ['#reelsediting', '#shortformvideo', '#contentcreator', '#visualstorytelling', '#creatortips'],
  };
  const guidance: ReelEvaluation['stanceByStanceGuidance'] = [
    {
      durationRange: ko ? '시작 문구' : 'Opening copy', stanceTheme: ko ? '바로 이해되는 약속' : 'Immediate promise',
      optionAHookText: captions.recommendedHooks[0], optionBHookText: captions.recommendedHooks[1], optionCHookText: captions.recommendedHooks[2],
      onScreenGuidance: ko ? '첫 화면의 빈 공간에 한 줄만 두고, 피사체를 가리지 마세요.' : 'Use one short line in the open space of the first image without covering the subject.',
    },
    {
      durationRange: ko ? '중간 문구' : 'Middle copy', stanceTheme: ko ? '변화의 이유' : 'Reason for the change',
      optionAHookText: ko ? '여기서 분위기가 달라집니다' : 'This is where the look changes',
      optionBHookText: ko ? '작은 차이가 결과를 바꿉니다' : 'A small choice changes the result',
      optionCHookText: ko ? '이 장면을 빼면 이야기가 약해집니다' : 'Without this moment, the story falls flat',
      onScreenGuidance: ko ? '화면에 보이는 변화와 같은 뜻의 문장만 남기고 설명을 길게 쓰지 마세요.' : 'Use a line that matches the visible change and avoid explaining more than the image needs.',
    },
    {
      durationRange: ko ? '마무리 문구' : 'Closing copy', stanceTheme: ko ? '기억할 한 문장' : 'Memorable takeaway',
      optionAHookText: ko ? '결국 차이는 디테일에서 납니다' : 'The difference is in the detail',
      optionBHookText: ko ? '여러분은 어느 쪽이 더 좋은가요?' : 'Which version works better for you?',
      optionCHookText: ko ? '다음 변화는 더 크게 보일 겁니다' : 'The next change will be even clearer',
      onScreenGuidance: ko ? '완성 화면 위에 결론 한 줄만 남겨 결과가 스스로 말하게 하세요.' : 'Leave one concluding line over the finished image and let the result speak for itself.',
    },
  ];

  return {
    id: `local-${input.videoContentHash || Date.now()}`,
    title: input.title || (ko ? '업로드된 릴스' : 'Uploaded Reel'),
    durationSeconds: input.durationSeconds, fileFormat: input.fileFormat, fileSizeMb: input.fileSizeMb,
    niche: input.niche, captionInput: input.captionInput, videoConcept: input.videoConcept,
    audioType: input.audioType, timestamp: new Date().toISOString(),
    executiveSummary, observedStrengths: strengths, observedWeaknesses: weaknesses,
    evidenceSummary: { sampledFrames: metrics?.sampledFrames ?? 0, analysisMode: 'measured-local', audioVerified: Boolean(audio), limitations: [ko ? '평가는 업로드된 영상에서 보이는 화면 흐름을 중심으로 작성되었습니다.' : 'The critique focuses on the visible flow of the uploaded Reel.'] },
    overallStars, overallScorePercent: Math.round(overallStars * 20), overallVerdict, expectedSkipRatePercent,
    followerGrowthPotentialPercent: clamp(Math.round(22 + overallStars * 14 + (payoffIsStrong ? 6 : 0)), 10, 94),
    nonFollowerInterestStars: oneDecimal(clamp(hook * .45 + payoff * .35 + pacing * .2, 0, 5)),
    shareabilitySendScore: clamp(Math.round(18 + payoff * 11 + pacing * 5), 10, 92),
    aspects: {
      hookStrength: {
        stars: hook, label: ko ? '첫인상과 맥락' : 'Opening impact and context', visualHook: openingIsStrong ? strengths[0] : weaknesses[0],
        textHook: hasCaption ? (ko ? '입력한 문구가 화면의 핵심 변화와 같은 약속을 하도록 더 짧게 다듬으세요.' : 'Shorten the supplied copy so it makes the same promise as the visible change.') : (ko ? '화면만으로 뜻이 완성되지 않으므로 첫 장면에 짧은 맥락 한 줄이 필요합니다.' : 'The image does not fully explain itself, so the opening needs one short line of context.'),
        audioHook: audio ? (ko ? '소리가 화면의 시작과 함께 들어와 첫인상을 보조합니다.' : 'The sound supports the opening instead of arriving separately from it.') : (ko ? '오디오보다 화면과 문구를 중심으로 판단했습니다.' : 'The judgment prioritizes the visible edit and copy.'),
        verdict: openingIsStrong ? (ko ? '첫인상은 살아 있습니다. 문구로 의미만 빠르게 완성하세요.' : 'The first impression works; the copy now needs to complete its meaning.') : (ko ? '결과를 먼저 보여주고 맥락을 한 줄로 붙여야 합니다.' : 'Lead with the result and add one line of context.'),
      },
      pacingAndStimulation: { stars: pacing, label: ko ? '화면 흐름과 변화' : 'Visual flow and progression', avgCutFrequencySec: 0, deadAirDetectedSec: 0, patternInterruptsCount: 0, verdict: pacingIsStrong ? (ko ? '장면 변화가 이어져 흐름이 살아 있습니다. 반복되는 정보만 덜어내세요.' : 'The visual progression stays active; remove only the shots that repeat information.') : (ko ? '중간 화면이 비슷하게 이어집니다. 각 장면이 새로운 정보를 보여주도록 바꾸세요.' : 'The middle looks too similar from shot to shot; make every image reveal something new.') },
      narrativeAndPayoff: { stars: payoff, label: ko ? '전개와 결과' : 'Story progression and payoff', setupDurationSec: 0, payoffTimingSec: 0, verdict: payoffIsStrong ? (ko ? '과정과 결과의 차이가 보여 결말을 이해할 수 있습니다.' : 'The process and result look different enough for the ending to land.') : (ko ? '마지막 결과를 더 깨끗하고 분명하게 보여줘야 결말이 기억에 남습니다.' : 'Show the final result more cleanly and distinctly so the ending is memorable.') },
      loopingAndRetention: { stars: loop, label: ko ? '반복 시청의 자연스러움' : 'Replay continuity', seamlessLoopScore: Math.round(value(metrics?.loopSimilarityScore) * 100), rewatchTriggerPresent: loopIsStrong, verdict: loopIsStrong ? (ko ? '끝과 시작이 시각적으로 이어져 다시 보기가 자연스럽습니다.' : 'The ending and opening connect visually, making a replay feel natural.') : (ko ? '마지막 구도를 첫 장면과 비슷하게 맞추면 반복 재생의 끊김이 줄어듭니다.' : 'Match the final composition to the opening so the replay feels less abrupt.') },
      technicalCompliance: { stars: technical, label: ko ? '모바일 화면 완성도' : 'Mobile visual polish', watermarkDetected: null, resolutionText: pictureIsStrong ? (ko ? '모바일에서 피사체가 또렷하게 보입니다.' : 'The subject reads clearly on a mobile screen.') : (ko ? '일부 장면의 디테일을 더 또렷하게 다듬어야 합니다.' : 'Some shots need cleaner subject detail.'), safeZoneViolation: null, captionQuality: hasCaption ? (ko ? '문구는 짧게 줄이고 피사체가 없는 여백에 두세요.' : 'Shorten the copy and place it in open space away from the subject.') : (ko ? '핵심 장면마다 한 줄 이하의 문구가 필요합니다.' : 'Key images need no more than one short line of copy.'), verdict: pictureIsStrong ? (ko ? '화면은 읽기 쉽습니다. 자막 여백과 장면별 밝기만 일관되게 유지하세요.' : 'The image is readable; keep text spacing and shot brightness consistent.') : (ko ? '흐리거나 어두운 장면만 골라 보정하면 훨씬 완성도 있어 보입니다.' : 'Correct only the soft or dark shots to make the Reel feel more polished.') },
    },
    actionableEdits: edits, captionOptimization: captions, stanceByStanceGuidance: guidance,
    criticalDefectsIdentified: weaknesses.slice(0, overallStars < 3 ? 3 : 2), isCachedEvaluation: false,
  };
}

export function createLocalCaptions(topic: string, niche: string, language: string) {
  const subject = topic.trim() || niche.trim() || (language === 'ko' ? '이 콘텐츠' : 'this idea');
  return language === 'ko'
    ? { hooks: [`${subject}, 결과가 이렇게 달라졌습니다`, `${subject}에서 대부분 놓치는 한 가지`, `평범했던 ${subject}를 이렇게 바꿨습니다`], valueCTA: '나중에 다시 볼 수 있게 저장해 두세요.', cliffhangerCTA: '다음에는 이 결과를 더 깔끔하게 만드는 방법을 보여드릴게요.', commentBaitQuestion: '여러분이라면 어떤 부분을 먼저 바꾸시겠어요?', hashtags: ['#릴스제작', '#숏폼콘텐츠', '#영상편집', '#콘텐츠전략', '#크리에이터팁'] }
    : { hooks: [`Here’s how ${subject} turned out`, `The one thing most people miss about ${subject}`, `I changed ordinary ${subject} into this`], valueCTA: 'Save this so you can use it on your next edit.', cliffhangerCTA: 'Next, I’ll show you how to make this result look even cleaner.', commentBaitQuestion: 'What would you change first?', hashtags: ['#reelsediting', '#shortformvideo', '#contentcreator', '#visualstorytelling', '#creatortips'] };
}
