import type { ReelEvaluation } from './types';

type AuditInput = {
  title: string; durationSeconds: number; fileFormat: string; fileSizeMb: number;
  niche: string; captionInput: string; videoConcept: string; audioType: string;
  videoContentHash?: string; videoMetrics?: VideoMetrics; language: 'en' | 'ko';
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
const r1 = (value: number) => Number(value.toFixed(1));
const r2 = (value: number) => Number(value.toFixed(2));
const sec = (value: number) => `${r1(Math.max(0, value))}s`;

export function createLocalEvaluation(input: AuditInput): ReelEvaluation {
  const m = input.videoMetrics;
  const ko = input.language === 'ko';
  const noCaption = !input.captionInput.trim();
  const noConcept = !input.videoConcept.trim();
  const subject = (input.videoConcept || input.niche || (ko ? '이 영상' : 'this video')).trim();
  const niche = (input.niche || (ko ? '콘텐츠' : 'content')).trim();
  const duration = Math.max(1, input.durationSeconds);
  const f = (value: number | undefined, fallback = 35) => (value ?? fallback) / 100;

  let hook = 1 + f(m?.earlyMotionScore) * 2.55 + f(m?.contrastScore, 40) * .5 + f(m?.sharpnessScore, 40) * .35 - f(m?.blackFrameRatio, 0);
  if ((m?.earlyMotionScore ?? 0) < 18) hook = Math.min(hook, 2.8);
  hook = r2(clamp(hook, .5, 5));
  const durationPenalty = duration <= 15 ? 0 : duration <= 30 ? .12 : .35;
  let pacing = 1.05 + f(m?.changeFrequencyScore) * 1.65 + f(m?.motionScore, 40) * .7 + f(m?.sceneCutScore) * .55 - f(m?.staticFrameRatio, 50) * .45 - durationPenalty;
  if ((m?.changeFrequencyScore ?? 0) < 22) pacing = Math.min(pacing, 2.9);
  pacing = r2(clamp(pacing, .5, 5));
  let narrative = 1.15 + f(m?.payoffChangeScore) * 2.15 + f(m?.changeFrequencyScore) * .55;
  if ((m?.payoffChangeScore ?? 0) < 18) narrative = Math.min(narrative, 2.9);
  narrative = r2(clamp(narrative, .5, 5));
  const loop = r2(clamp(.85 + f(m?.loopSimilarityScore, 30) * 3.05, .5, 4.1));
  const resolution = m ? (m.width >= 1080 && m.height >= 1080 ? 1.55 : m.width >= 720 ? .9 : .25) : .45;
  let technical = 1.05 + resolution + (m && m.height > m.width ? .75 : .15) + f(m?.sharpnessScore, 40) * .65 + f(m?.colorfulnessScore, 40) * .2 + f(m?.exposureStabilityScore, 40) * .3 - f(m?.blackFrameRatio, 0) * .7;
  if (!m || m.width < 720) technical = Math.min(technical, 3);
  technical = r2(clamp(technical, .5, 5));
  const penalty = [hook, pacing, narrative].filter((score) => score < 1.8).length * .08;
  const stars = r2(clamp(hook * .3 + pacing * .25 + narrative * .2 + loop * .15 + technical * .1 - penalty, .5, 5));
  const verdict = stars >= 4.2 ? 'Viral Contender' : stars >= 3.5 ? 'Strong Growth' : stars >= 2.8 ? 'Moderate Retention' : 'High Skip Risk';
  const expectedSkipRatePercent = stars >= 4.2
    ? clamp(Math.round(28 - stars * 3), 5, 14)
    : stars >= 3.5
      ? clamp(Math.round(53 - stars * 8), 15, 29)
      : stars >= 2.8
        ? clamp(Math.round(70 - stars * 10), 30, 45)
        : clamp(Math.round(75 - stars * 8), 46, 80);

  const openingTime = m?.strongestOpeningChangeTimeSec ?? Math.min(1, duration);
  const strongestTime = m?.strongestChangeTimeSec ?? duration / 2;
  const staticStart = m?.longestStaticStartSec ?? 0;
  const staticEnd = m?.longestStaticEndSec ?? 0;
  const staticDuration = m?.longestStaticDurationSec ?? 0;
  const cutCount = m?.detectedCutTimesSec.length ?? 0;
  const cutList = m?.detectedCutTimesSec.slice(0, 4).map(sec).join(', ') || (ko ? '감지되지 않음' : 'none detected');
  const timeline = m?.timelineSamples ?? [];
  const mostDynamic = [...timeline].sort((a, b) => b.motion - a.motion).slice(0, 3);
  const leastClear = [...timeline].sort((a, b) => a.sharpness - b.sharpness)[0];
  const darkest = [...timeline].sort((a, b) => a.brightness - b.brightness)[0];
  const openingSample = timeline[0];
  const endingSample = timeline[timeline.length - 1];
  const dynamicList = mostDynamic.length
    ? mostDynamic.map((point) => `${sec(point.timeSec)} (${point.motion}/100)`).join(', ')
    : (ko ? '확인 불가' : 'unavailable');
  const payoffTime = r1(duration * .85);
  const staticRange = `${sec(staticStart)}–${sec(staticEnd)}`;
  const evidence = m
    ? (ko ? `${m.sampledFrames}개 프레임 측정: 움직임 ${m.motionScore}, 변화 빈도 ${m.changeFrequencyScore}, 선명도 ${m.sharpnessScore}, 노출 안정성 ${m.exposureStabilityScore}/100.` : `${m.sampledFrames} measured frames: motion ${m.motionScore}, change frequency ${m.changeFrequencyScore}, sharpness ${m.sharpnessScore}, exposure stability ${m.exposureStabilityScore}/100.`)
    : (ko ? '영상 프레임 측정값을 사용할 수 없습니다.' : 'Video-frame measurements were unavailable.');

  const observedStrengths = m ? [
    ko
      ? `가장 강한 시각 변화가 ${sec(strongestTime)}에 측정되었습니다(움직임 피크 ${mostDynamic[0]?.motion ?? 0}/100).`
      : `The strongest visual change lands at ${sec(strongestTime)} (peak motion ${mostDynamic[0]?.motion ?? 0}/100).`,
    m.loopSimilarityScore >= 70
      ? (ko ? `첫·마지막 프레임 유사도 ${m.loopSimilarityScore}/100으로 시각 루프 기반이 좋습니다.` : `First/final frame similarity is ${m.loopSimilarityScore}/100, providing a strong visual-loop base.`)
      : (ko ? `해상도 ${m.width}×${m.height}, 평균 선명도 ${m.sharpnessScore}/100으로 측정되었습니다.` : `The upload measures ${m.width}×${m.height} with ${m.sharpnessScore}/100 average sharpness.`),
  ] : [evidence];
  const observedWeaknesses = m ? [
    ko
      ? `최장 저변화 구간은 ${staticRange}이며 ${sec(staticDuration)} 지속됩니다.`
      : `The longest low-motion interval is ${staticRange}, lasting ${sec(staticDuration)}.`,
    ko
      ? `후반 시각 변화량은 ${m.payoffChangeScore}/100, 첫·마지막 프레임 유사도는 ${m.loopSimilarityScore}/100입니다.`
      : `Late-stage visual change is ${m.payoffChangeScore}/100; first/final similarity is ${m.loopSimilarityScore}/100.`,
  ] : [evidence];
  const executiveSummary = ko
    ? `이 결과는 의미 해석을 꾸며낸 AI 평문이 아니라 업로드 영상의 ${m?.sampledFrames ?? 0}개 프레임 측정에 기반한 보수적 진단입니다. 시작부 움직임 ${m?.earlyMotionScore ?? 0}/100, 변화 빈도 ${m?.changeFrequencyScore ?? 0}/100, 후반 변화 ${m?.payoffChangeScore ?? 0}/100으로 볼 때 가장 먼저 손볼 지점은 ${staticRange}의 저변화 구간과 ${sec(payoffTime)} 전후의 결말 강조입니다. 오디오·화면 자막 의미·워터마크는 이 모드에서 검증하지 않았습니다.`
    : `This is a conservative measured scan of ${m?.sampledFrames ?? 0} frames, not an invented semantic review. With opening motion at ${m?.earlyMotionScore ?? 0}/100, change frequency at ${m?.changeFrequencyScore ?? 0}/100, and late-stage change at ${m?.payoffChangeScore ?? 0}/100, the first priorities are the low-motion span at ${staticRange} and a clearer payoff around ${sec(payoffTime)}. Audio, on-screen text meaning, and watermarks were not verified in this mode.`;

  const defects: string[] = [];
  if (!m) defects.push(evidence);
  if (m && m.earlyMotionScore < 18) defects.push(ko ? `첫 3초 움직임 ${m.earlyMotionScore}/100으로 시작부 이탈 위험이 큽니다.` : `Opening motion is ${m.earlyMotionScore}/100, creating high early-skip risk.`);
  if (m && staticDuration >= 1.5) defects.push(ko ? `${staticRange}에 ${sec(staticDuration)}의 최장 시각 정체가 측정됐습니다.` : `The longest visual hold lasts ${sec(staticDuration)} at ${staticRange}.`);
  if (m && m.payoffChangeScore < 18) defects.push(ko ? `후반 변화량 ${m.payoffChangeScore}/100으로 결말의 시각적 구분이 약합니다.` : `Late-stage change is ${m.payoffChangeScore}/100, so the payoff is weakly differentiated.`);
  if (m && m.blackFrameRatio >= 5) defects.push(ko ? `샘플 프레임 중 ${m.blackFrameRatio}%가 거의 검은 화면입니다.` : `${m.blackFrameRatio}% of sampled frames are near-black.`);
  if (m && (m.width < 720 || m.height < 720)) defects.push(ko ? `해상도 ${m.width}×${m.height}는 숏폼 배포 기준보다 낮습니다.` : `Resolution ${m.width}×${m.height} is below a strong short-form baseline.`);
  if (leastClear && leastClear.sharpness < 28) defects.push(ko ? `${sec(leastClear.timeSec)} 부근 선명도 ${leastClear.sharpness}/100으로 디테일 손실이 가장 큽니다.` : `Detail is weakest near ${sec(leastClear.timeSec)}, where measured sharpness falls to ${leastClear.sharpness}/100.`);
  if (darkest && darkest.brightness < 16) defects.push(ko ? `${sec(darkest.timeSec)} 부근 밝기 ${darkest.brightness}/100으로 피사체 식별력이 가장 낮습니다.` : `Visibility is lowest near ${sec(darkest.timeSec)}, where brightness falls to ${darkest.brightness}/100.`);

  const edits: ReelEvaluation['actionableEdits'] = [];
  if ((m?.earlyMotionScore ?? 0) < 55) edits.push({ id: 'opening', timestampRange: `0-${sec(Math.min(3, duration))}`, type: 'hook', severity: (m?.earlyMotionScore ?? 0) < 18 ? 'critical' : 'recommended', issue: ko ? `첫 3초 움직임 ${m?.earlyMotionScore ?? 0}/100, 시작부 최대 변화는 ${sec(openingTime)}입니다.` : `Opening motion is ${m?.earlyMotionScore ?? 0}/100; the strongest early change is at ${sec(openingTime)}.`, solution: ko ? `${sec(openingTime)}의 변화 장면을 첫 프레임 가까이 당기고 ${subject}의 핵심 결과를 1초 안에 보여주세요.` : `Move the change at ${sec(openingTime)} closer to frame one and reveal the key result of ${subject} within one second.` });
  if (m && staticDuration >= .8) edits.push({ id: 'static', timestampRange: staticRange, type: 'pacing', severity: staticDuration >= 1.5 ? 'critical' : 'recommended', issue: ko ? `${staticRange}가 최장 저변화 구간이며 ${sec(staticDuration)} 지속됩니다.` : `${staticRange} is this upload's longest low-change span, lasting ${sec(staticDuration)}.`, solution: ko ? `이 구간을 ${Math.max(.3, r1(staticDuration / 2))}초 이하로 압축하거나 ${subject}에 관한 새 앵글·동작·정보를 넣으세요.` : `Compress it to ${Math.max(.3, r1(staticDuration / 2))}s or less, or add a new angle, action, or information specific to ${subject}.` });
  if ((m?.payoffChangeScore ?? 0) < 55) edits.push({ id: 'payoff', timestampRange: `${sec(duration * .72)}–${sec(duration)}`, type: 'payoff', severity: (m?.payoffChangeScore ?? 0) < 18 ? 'critical' : 'recommended', issue: ko ? `마지막 15% 변화량은 ${m?.payoffChangeScore ?? 0}/100입니다.` : `Change across the final 15% is ${m?.payoffChangeScore ?? 0}/100.`, solution: ko ? `${sec(payoffTime)} 전후에 ${subject}의 완성 결과를 더 명확하게 유지하고 직전 장면과 대비시키세요.` : `Hold the completed result of ${subject} clearly around ${sec(payoffTime)} and contrast it with the preceding shot.` });
  if ((m?.loopSimilarityScore ?? 0) < 70) edits.push({ id: 'loop', timestampRange: `${sec(duration - Math.min(1.5, duration / 4))}–${sec(duration)}`, type: 'cut', severity: 'recommended', issue: ko ? `첫·마지막 프레임 유사도 ${m?.loopSimilarityScore ?? 0}/100입니다.` : `First-to-last visual similarity is ${m?.loopSimilarityScore ?? 0}/100.`, solution: ko ? `마지막 구도·밝기·피사체 위치를 첫 프레임과 맞춰 시각 루프를 강화하세요.` : `Match the ending composition, brightness, and subject position to frame one to strengthen the visual loop.` });
  if (m && (m.sharpnessScore < 38 || m.exposureStabilityScore < 55)) edits.push({ id: 'quality', timestampRange: `0–${sec(duration)}`, type: 'safezone', severity: 'recommended', issue: ko ? `선명도 ${m.sharpnessScore}/100, 노출 안정성 ${m.exposureStabilityScore}/100입니다.` : `Sharpness is ${m.sharpnessScore}/100 and exposure stability is ${m.exposureStabilityScore}/100.`, solution: ko ? `과도한 압축을 줄이고 노출 변화가 큰 컷을 개별 보정해 ${subject}의 디테일을 일정하게 유지하세요.` : `Reduce aggressive compression and correct unstable shots individually so ${subject} stays consistently detailed.` });
  if (leastClear && leastClear.sharpness < 40) edits.push({ id: 'clarity-point', timestampRange: `${sec(Math.max(0, leastClear.timeSec - .4))}–${sec(Math.min(duration, leastClear.timeSec + .4))}`, type: 'safezone', severity: leastClear.sharpness < 25 ? 'critical' : 'recommended', issue: ko ? `이 업로드에서 가장 흐린 측정 지점은 ${sec(leastClear.timeSec)}이며 선명도 ${leastClear.sharpness}/100입니다.` : `This upload's least-clear measured point is ${sec(leastClear.timeSec)} at ${leastClear.sharpness}/100 sharpness.`, solution: ko ? `${subject}의 이 장면만 별도로 선명화하거나 더 또렷한 원본 컷으로 교체하세요. 전체 영상에 일괄 샤픈을 적용하지 마세요.` : `Sharpen only this shot of ${subject}, or replace it with a clearer source take; do not apply blanket sharpening to the full reel.` });
  if (!edits.length) edits.push({ id: 'refine', timestampRange: `${sec(Math.max(0, strongestTime - .5))}–${sec(Math.min(duration, strongestTime + .5))}`, type: 'pacing', severity: 'optional', issue: ko ? `${sec(strongestTime)}에서 최대 시각 변화가 측정됐고 치명적 결함은 없습니다.` : `The strongest visual change is at ${sec(strongestTime)}; no critical measured defect was found.`, solution: ko ? `이 지점을 ${subject}의 핵심 전환점으로 유지하고 주변 컷 리듬만 미세 조정하세요.` : `Keep this as the main turning point for ${subject} and only fine-tune the surrounding cut rhythm.` });

  const safeTag = niche.replace(/[^\p{L}\p{N}]/gu, '');
  const captions: ReelEvaluation['captionOptimization'] = ko ? {
    recommendedHooks: [`호기심형 — ${sec(openingTime)}에 ${subject}가 달라집니다. 무엇이 바뀌었을까요?`, `부정 편향형 — ${staticRange}를 그대로 두면 ${subject}의 몰입이 끊깁니다.`, `변화형 — ${subject}: ${staticDuration >= 1 ? `${staticRange}의 정체 구간` : '과정'}부터 최종 결과까지.`],
    valueCTA: `${subject}의 ${sec(strongestTime)} 전후를 비교해 보세요. 편집 포인트가 필요하다면 저장해 두세요.`, cliffhangerCTA: `${subject}의 다음 버전에서는 ${staticDuration >= .8 ? `${staticRange}의 정체 구간을 줄인 결과` : '첫 장면과 마지막 장면을 더 정확히 연결한 결과'}를 보여드리겠습니다.`, commentBaitQuestion: `${subject}에서 ${cutList} 중 어느 변화 지점이 가장 효과적으로 보이나요?`, targetHashtags: [`#${safeTag || '콘텐츠'}`, '#릴스제작', '#숏폼콘텐츠', '#영상편집', '#콘텐츠크리에이터']
  } : {
    recommendedHooks: [`Curiosity — ${subject} changes at ${sec(openingTime)}. Can you spot what shifts?`, `Negative bias — Leaving the hold at ${staticRange} kills momentum in ${subject}.`, `Transformation — ${subject}: from ${staticDuration >= 1 ? `the stall at ${staticRange}` : 'the process'} to the final result.`],
    valueCTA: `Compare ${subject} immediately before and after ${sec(strongestTime)}; save this for the edit reference.`, cliffhangerCTA: `The next version of ${subject} will show ${staticDuration >= .8 ? `what changes after tightening ${staticRange}` : 'a tighter visual match between the first and final frame'}.`, commentBaitQuestion: `Which measured transition in ${subject} works best—${cutList}?`, targetHashtags: [`#${safeTag || 'content'}`, '#reelsediting', '#shortformvideo', '#videocreator', '#contentstrategy']
  };

  const p1 = r1(Math.min(3, duration));
  const p2 = r1(Math.min(duration, Math.max(p1 + 1, duration * .55)));
  const guidance: NonNullable<ReelEvaluation['stanceByStanceGuidance']> = [
    { durationRange: `0-${p1}s`, stanceTheme: ko ? `시작 움직임 ${m?.earlyMotionScore ?? 0}/100` : `Opening motion ${m?.earlyMotionScore ?? 0}/100`, optionAHookText: captions.recommendedHooks[0], optionBHookText: captions.recommendedHooks[1], optionCHookText: captions.recommendedHooks[2], onScreenGuidance: ko ? `${sec(openingTime)}의 강한 변화에 맞춰 텍스트를 0.5초 안에 표시하세요.` : `Time the text to the strong change near ${sec(openingTime)} and show it within 0.5s.` },
    { durationRange: `${p1}-${p2}s`, stanceTheme: ko ? `중반 변화 지점 ${dynamicList}` : `Measured change peaks ${dynamicList}`, optionAHookText: ko ? `${sec(strongestTime)}: ${subject}의 핵심 전환` : `${sec(strongestTime)}: the key turn in ${subject}`, optionBHookText: ko ? `${cutList} 중 어디서 가장 달라질까요?` : `Which transition changes ${subject} most: ${cutList}?`, optionCHookText: ko ? `${staticRange}를 줄이면 결과가 달라집니다.` : `Tightening ${staticRange} changes the result.`, onScreenGuidance: ko ? `실제 주요 변화 ${cutList}에 맞춰 텍스트를 전환하고, ${staticRange}에는 새 정보를 넣거나 축소하세요.` : `Change text on the measured transitions at ${cutList}; add new information at ${staticRange} or shorten that span.` },
    { durationRange: `${p2}-${r1(duration)}s`, stanceTheme: ko ? `후반 변화 ${m?.payoffChangeScore ?? 0}/100` : `Late-stage change ${m?.payoffChangeScore ?? 0}/100`, optionAHookText: ko ? `${subject}의 최종 결과` : `The final result of ${subject}`, optionBHookText: ko ? '어느 버전이 더 효과적인가요?' : 'Which version works better?', optionCHookText: ko ? '마지막 장면에서 완성됩니다.' : 'It resolves in the final shot.', onScreenGuidance: ko ? `${sec(payoffTime)} 전후에 결과를 충분히 유지하고 마지막 구도를 첫 프레임과 비교하세요.` : `Hold the result around ${sec(payoffTime)} and compare the ending composition with frame one.` },
  ];

  return {
    id: `eval-${Date.now()}`, title: input.title, durationSeconds: duration, fileFormat: input.fileFormat, fileSizeMb: input.fileSizeMb, niche,
    captionInput: input.captionInput, videoConcept: input.videoConcept, audioType: input.audioType, timestamp: new Date().toISOString(),
    executiveSummary,
    observedStrengths,
    observedWeaknesses,
    evidenceSummary: {
      sampledFrames: m?.sampledFrames ?? 0,
      analysisMode: 'measured-local',
      audioVerified: false,
      limitations: ko
        ? ['오디오 파형 미검증', '화면 자막 의미·워터마크·안전지대는 멀티모달 분석 없이 확정할 수 없음']
        : ['Audio waveform not verified', 'On-screen text meaning, watermarks, and safe-zone placement require multimodal analysis'],
    },
    overallStars: stars, overallScorePercent: Math.round(stars * 20), overallVerdict: verdict,
    expectedSkipRatePercent, followerGrowthPotentialPercent: Math.round(stars * 18 + 5), nonFollowerInterestStars: r2(stars * .95), shareabilitySendScore: Math.round(stars * 18.5),
    criticalDefectsIdentified: defects.length ? defects : [ko ? `측정된 시각 신호에서 치명적 결함은 없었습니다. ${evidence}` : `No critical defect was found in the measured visual signals. ${evidence}`],
    aspects: {
      hookStrength: { stars: hook, label: ko ? '0-3초 시각 훅' : 'Measured 0-3s Visual Hook', visualHook: m ? (ko ? `${subject}의 첫 측정 밝기 ${openingSample?.brightness ?? m.brightnessScore}/100, 시작 움직임 ${m.earlyMotionScore}/100, 최대 시작 변화 ${sec(openingTime)}.` : `For ${subject}, the opening measures ${openingSample?.brightness ?? m.brightnessScore}/100 brightness and ${m.earlyMotionScore}/100 motion; its strongest early shift is ${sec(openingTime)}.`) : evidence, textHook: noCaption ? (ko ? `${subject}용 입력 캡션이 없어 영상 신호만 채점했습니다.` : `No caption was supplied for ${subject}, so only video evidence was scored.`) : (ko ? `“${input.captionInput}”가 ${sec(openingTime)}의 첫 강한 변화와 얼마나 빨리 연결되는지가 핵심입니다.` : `“${input.captionInput}” must connect to the first strong change at ${sec(openingTime)}.`), audioHook: ko ? `${subject}의 오디오는 “${input.audioType || '미입력'}”로 설명됨; 실제 파형은 미검증입니다.` : `Audio for ${subject} is described as “${input.audioType || 'not supplied'}”; the waveform was not verified.`, verdict: ko ? `${sec(openingTime)} 전까지 ${subject}의 결과나 갈등을 드러내야 현재 ${hook}/5 훅 점수를 개선할 수 있습니다.` : `Reveal the result or tension of ${subject} before ${sec(openingTime)} to improve this upload's ${hook}/5 hook score.` },
      pacingAndStimulation: { stars: pacing, label: ko ? '측정된 시각 페이싱' : 'Measured Visual Pacing', avgCutFrequencySec: cutCount ? r1(duration / cutCount) : 0, deadAirDetectedSec: staticDuration, patternInterruptsCount: cutCount, verdict: m ? (ko ? `${subject}의 주요 전환은 ${cutList}; 변화 피크는 ${dynamicList}. 최장 저변화 구간은 ${staticRange} (${sec(staticDuration)})입니다.` : `${subject} has major transitions at ${cutList}; its strongest measured changes are ${dynamicList}. The longest low-change span is ${staticRange} (${sec(staticDuration)}).`) : evidence },
      narrativeAndPayoff: { stars: narrative, label: ko ? '측정된 전개 & 결과 강조' : 'Measured Progression & Payoff', setupDurationSec: p1, payoffTimingSec: payoffTime, verdict: ko ? `${noConcept ? '기획 의도 미입력; ' : `기획 의도 “${input.videoConcept}”; `}후반 변화 ${m?.payoffChangeScore ?? 0}/100, 최대 전체 변화 ${sec(strongestTime)}.` : `${noConcept ? 'No creative intent supplied; ' : `Intent: “${input.videoConcept}”; `}late-stage change ${m?.payoffChangeScore ?? 0}/100, strongest overall change at ${sec(strongestTime)}.` },
      loopingAndRetention: { stars: loop, label: ko ? '첫·마지막 프레임 연결성' : 'First-to-Last Frame Continuity', seamlessLoopScore: m?.loopSimilarityScore ?? 0, rewatchTriggerPresent: (m?.loopSimilarityScore ?? 0) >= 70, verdict: ko ? `${subject}의 첫/끝 유사도 ${m?.loopSimilarityScore ?? 0}/100; 밝기는 ${openingSample?.brightness ?? 0}→${endingSample?.brightness ?? 0}, 대비는 ${openingSample?.contrast ?? 0}→${endingSample?.contrast ?? 0}입니다.` : `For ${subject}, first/last similarity is ${m?.loopSimilarityScore ?? 0}/100; brightness moves ${openingSample?.brightness ?? 0}→${endingSample?.brightness ?? 0}, and contrast ${openingSample?.contrast ?? 0}→${endingSample?.contrast ?? 0}.` },
      technicalCompliance: { stars: technical, label: ko ? '측정된 영상 품질' : 'Measured Video Quality', watermarkDetected: null, resolutionText: m ? `${m.width} × ${m.height}` : (ko ? '확인 불가' : 'Not verified'), safeZoneViolation: null, captionQuality: noCaption ? (ko ? '입력 캡션 없음; 화면 자막 위치 미검증' : 'No supplied caption; on-screen placement not verified') : (ko ? '입력 캡션 확인; 화면 내 위치 미검증' : 'Supplied caption reviewed; on-screen placement not verified'), verdict: m ? (ko ? `선명도 ${m.sharpnessScore}/100, 색채량 ${m.colorfulnessScore}/100, 노출 안정성 ${m.exposureStabilityScore}/100, 암전 ${m.blackFrameRatio}%.` : `Sharpness ${m.sharpnessScore}/100, colorfulness ${m.colorfulnessScore}/100, exposure stability ${m.exposureStabilityScore}/100, near-black frames ${m.blackFrameRatio}%.`) : evidence },
    },
    actionableEdits: edits, captionOptimization: captions, stanceByStanceGuidance: guidance, isCachedEvaluation: false,
  };
}

export function createLocalCaptions(topic: string, niche: string, language: string) {
  const subject = topic.trim() || niche.trim() || (language === 'ko' ? '이 콘텐츠' : 'this content');
  return language === 'ko'
    ? { hooks: [`${subject}, 결과부터 먼저 보여드릴게요.`, `${subject}에서 가장 달라지는 순간입니다.`, `${subject}의 완성도를 바꾼 한 장면.`], valueCTA: `${subject}의 과정과 결과를 비교하고 저장해 두세요.`, cliffhangerCTA: `${subject}의 다음 변화도 이어서 보여드리겠습니다.`, commentBaitQuestion: `${subject}에서 가장 인상적인 변화는 무엇인가요?`, hashtags: ['#릴스제작', '#숏폼콘텐츠', '#영상편집', '#콘텐츠전략', '#크리에이터'] }
    : { hooks: [`Here is the result of ${subject} first.`, `This is where ${subject} changes most.`, `One visual decision changed ${subject}.`], valueCTA: `Compare the process and result of ${subject}, and save this breakdown.`, cliffhangerCTA: `The next change to ${subject} will continue this breakdown.`, commentBaitQuestion: `Which moment in ${subject} made the strongest difference?`, hashtags: ['#reelsediting', '#shortformvideo', '#videocreator', '#contentstrategy', '#creator'] };
}
