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
  const niche = (input.niche || (ko ? '콘텐츠' : 'content')).trim();
  const duration = Math.max(1, input.durationSeconds);
  const f = (value: number | undefined, fallback = 35) => (value ?? fallback) / 100;

  let hook = 1 + f(m?.earlyMotionScore) * 2.35 + f(m?.contrastScore, 40) * .45 + f(m?.sharpnessScore, 40) * .3 + (noCaption ? 0 : .3) - f(m?.blackFrameRatio, 0);
  if ((m?.earlyMotionScore ?? 0) < 18) hook = Math.min(hook, 2.8);
  if (noCaption) hook = Math.min(hook, 4.3);
  hook = r2(clamp(hook, .5, 5));
  const durationPenalty = duration <= 15 ? 0 : duration <= 30 ? .12 : .35;
  let pacing = 1.05 + f(m?.changeFrequencyScore) * 1.65 + f(m?.motionScore, 40) * .7 + f(m?.sceneCutScore) * .55 - f(m?.staticFrameRatio, 50) * .45 - durationPenalty;
  if ((m?.changeFrequencyScore ?? 0) < 22) pacing = Math.min(pacing, 2.9);
  pacing = r2(clamp(pacing, .5, 5));
  let narrative = 1.05 + f(m?.payoffChangeScore) * 1.8 + f(m?.changeFrequencyScore) * .4 + (noConcept ? 0 : .55);
  if (noConcept) narrative = Math.min(narrative, 3.7);
  if ((m?.payoffChangeScore ?? 0) < 18) narrative = Math.min(narrative, 2.9);
  narrative = r2(clamp(narrative, .5, 5));
  const loop = r2(clamp(.85 + f(m?.loopSimilarityScore, 30) * 3.05, .5, 4.1));
  const resolution = m ? (m.width >= 1080 && m.height >= 1080 ? 1.55 : m.width >= 720 ? .9 : .25) : .45;
  let technical = .85 + resolution + (m && m.height > m.width ? .65 : .15) + (noConcept ? 0 : .2) + (noCaption ? 0 : .2) + f(m?.sharpnessScore, 40) * .45 + f(m?.colorfulnessScore, 40) * .2 + f(m?.exposureStabilityScore, 40) * .25 - f(m?.blackFrameRatio, 0) * .7;
  if (!m || m.width < 720) technical = Math.min(technical, 3);
  technical = r2(clamp(technical, .5, 5));
  const penalty = [hook, pacing, narrative].filter((score) => score < 1.8).length * .08;
  const stars = r2(clamp(hook * .3 + pacing * .25 + narrative * .2 + loop * .1 + technical * .15 - penalty, .5, 5));
  const verdict = stars >= 4.2 ? 'Viral Contender' : stars >= 3.5 ? 'Strong Growth' : stars >= 2.8 ? 'Moderate Retention' : 'High Skip Risk';

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
  if ((m?.earlyMotionScore ?? 0) < 55) edits.push({ id: 'opening', timestampRange: `0-${sec(Math.min(3, duration))}`, type: 'hook', severity: (m?.earlyMotionScore ?? 0) < 18 ? 'critical' : 'recommended', issue: ko ? `이 파일의 첫 3초 움직임은 ${m?.earlyMotionScore ?? 0}/100이며, 시작부 최대 변화는 ${sec(openingTime)}입니다.` : `In this file, opening motion is ${m?.earlyMotionScore ?? 0}/100 and the strongest early change occurs at ${sec(openingTime)}.`, solution: ko ? `${sec(openingTime)} 전후의 실제 변화 컷을 0.0–0.7초로 당기세요. 현재 첫 프레임 밝기 ${openingSample?.brightness ?? 0}/100와 대비 ${openingSample?.contrast ?? 0}/100는 유지하되 변화가 더 빨리 시작되게 하세요.` : `Move the actual change surrounding ${sec(openingTime)} into 0.0–0.7s. Preserve this file's opening brightness (${openingSample?.brightness ?? 0}/100) and contrast (${openingSample?.contrast ?? 0}/100), but start the change sooner.` });
  if (m && staticDuration >= .8) edits.push({ id: 'static', timestampRange: staticRange, type: 'pacing', severity: staticDuration >= 1.5 ? 'critical' : 'recommended', issue: ko ? `${staticRange}가 이 파일의 최장 저변화 구간이며 ${sec(staticDuration)} 지속됩니다.` : `${staticRange} is this file's longest low-change span, lasting ${sec(staticDuration)}.`, solution: ko ? `${staticRange}를 ${Math.max(.3, r1(staticDuration / 2))}초 이하로 줄이거나, 바로 다음 감지 전환(${cutList})의 프레임을 이 구간에 앞당겨 배치하세요.` : `Reduce ${staticRange} to ${Math.max(.3, r1(staticDuration / 2))}s or less, or pull frames from the next detected transition (${cutList}) into this interval.` });
  if ((m?.payoffChangeScore ?? 0) < 55) edits.push({ id: 'payoff', timestampRange: `${sec(duration * .72)}–${sec(duration)}`, type: 'payoff', severity: (m?.payoffChangeScore ?? 0) < 18 ? 'critical' : 'recommended', issue: ko ? `이 파일 마지막 15%의 변화량은 ${m?.payoffChangeScore ?? 0}/100입니다.` : `Measured change across this file's final 15% is ${m?.payoffChangeScore ?? 0}/100.`, solution: ko ? `${sec(strongestTime)}의 최대 변화 장면을 ${sec(payoffTime)} 전후의 후반부와 시각적으로 대조하고, 마지막 프레임을 최소 0.6초 유지하세요.` : `Visually contrast the maximum-change frame at ${sec(strongestTime)} with the late section around ${sec(payoffTime)}, then hold the final frame for at least 0.6s.` });
  if ((m?.loopSimilarityScore ?? 0) < 70) edits.push({ id: 'loop', timestampRange: `${sec(duration - Math.min(1.5, duration / 4))}–${sec(duration)}`, type: 'cut', severity: 'recommended', issue: ko ? `첫·마지막 프레임 유사도 ${m?.loopSimilarityScore ?? 0}/100입니다.` : `First-to-last visual similarity is ${m?.loopSimilarityScore ?? 0}/100.`, solution: ko ? `마지막 구도·밝기·피사체 위치를 첫 프레임과 맞춰 시각 루프를 강화하세요.` : `Match the ending composition, brightness, and subject position to frame one to strengthen the visual loop.` });
  if (m && (m.sharpnessScore < 38 || m.exposureStabilityScore < 55)) edits.push({ id: 'quality', timestampRange: `0–${sec(duration)}`, type: 'safezone', severity: 'recommended', issue: ko ? `이 파일의 평균 선명도는 ${m.sharpnessScore}/100, 노출 안정성은 ${m.exposureStabilityScore}/100입니다.` : `This file measures ${m.sharpnessScore}/100 average sharpness and ${m.exposureStabilityScore}/100 exposure stability.`, solution: ko ? `전체 보정보다 ${sec(leastClear?.timeSec ?? 0)}의 선명도 ${leastClear?.sharpness ?? m.sharpnessScore}/100 구간과 ${sec(darkest?.timeSec ?? 0)}의 밝기 ${darkest?.brightness ?? m.brightnessScore}/100 구간을 각각 보정하세요.` : `Instead of a global correction, separately adjust the ${leastClear?.sharpness ?? m.sharpnessScore}/100 sharpness point at ${sec(leastClear?.timeSec ?? 0)} and the ${darkest?.brightness ?? m.brightnessScore}/100 brightness point at ${sec(darkest?.timeSec ?? 0)}.` });
  if (leastClear && leastClear.sharpness < 40) edits.push({ id: 'clarity-point', timestampRange: `${sec(Math.max(0, leastClear.timeSec - .4))}–${sec(Math.min(duration, leastClear.timeSec + .4))}`, type: 'safezone', severity: leastClear.sharpness < 25 ? 'critical' : 'recommended', issue: ko ? `이 업로드에서 가장 흐린 측정 지점은 ${sec(leastClear.timeSec)}이며 선명도 ${leastClear.sharpness}/100입니다.` : `This upload's least-clear measured point is ${sec(leastClear.timeSec)} at ${leastClear.sharpness}/100 sharpness.`, solution: ko ? `이 0.8초 구간만 별도로 선명화하거나 더 또렷한 원본 프레임으로 교체하세요. 전체 영상에 일괄 샤픈을 적용하지 마세요.` : `Sharpen only this 0.8s interval or replace it with a clearer source frame; do not apply blanket sharpening to the full reel.` });
  if (!edits.length) edits.push({ id: 'refine', timestampRange: `${sec(Math.max(0, strongestTime - .5))}–${sec(Math.min(duration, strongestTime + .5))}`, type: 'pacing', severity: 'optional', issue: ko ? `${sec(strongestTime)}에서 이 파일의 최대 시각 변화가 측정됐고 치명적 결함은 없습니다.` : `This file's strongest visual change occurs at ${sec(strongestTime)}; no critical measured defect was found.`, solution: ko ? `이 변화 전후 0.5초의 컷 길이는 유지하고, 다른 구간만 조정해 현재 리듬 피크를 보존하세요.` : `Preserve the half-second on each side of this transition and adjust other intervals so this upload's rhythm peak remains intact.` });

  const paceTag = (m?.changeFrequencyScore ?? 0) >= 55 ? (ko ? '#빠른컷편집' : '#FastCutEditing') : (ko ? '#슬로우페이스영상' : '#SlowPacedVideo');
  const lightTag = (m?.contrastScore ?? 0) >= 55 ? (ko ? '#고대비영상' : '#HighContrastVideo') : (ko ? '#소프트톤영상' : '#SoftToneVideo');
  const formatTag = m && m.height > m.width ? (ko ? '#세로형영상' : '#VerticalVideo') : (ko ? '#가로형영상' : '#LandscapeVideo');
  const captions: ReelEvaluation['captionOptimization'] = ko ? {
    recommendedHooks: [`${sec(openingTime)}에 화면이 크게 달라집니다—그 순간을 놓치지 마세요.`, `${duration}초 영상의 최대 변화는 ${sec(strongestTime)}입니다.`, `${staticRange} 이후 화면 리듬이 어떻게 바뀌는지 보세요.`],
    valueCTA: `${sec(strongestTime)} 직전과 직후 프레임을 비교해 보세요. 이 전환을 다시 볼 수 있도록 저장하세요.`, cliffhangerCTA: `${staticDuration >= .8 ? `${staticRange}를 절반으로 줄인 편집본` : `첫·끝 유사도 ${m?.loopSimilarityScore ?? 0}/100을 개선한 편집본`}도 비교해 보겠습니다.`, commentBaitQuestion: `감지된 전환 ${cutList} 중 어느 시점이 가장 강하게 느껴지나요?`, targetHashtags: [formatTag, paceTag, lightTag, '#릴스편집', '#영상분석']
  } : {
    recommendedHooks: [`The frame changes sharply at ${sec(openingTime)}—watch that moment.`, `This ${duration}s reel reaches its biggest visual shift at ${sec(strongestTime)}.`, `Watch how the visual rhythm changes after ${staticRange}.`],
    valueCTA: `Compare the frames immediately before and after ${sec(strongestTime)}; save this to revisit the transition.`, cliffhangerCTA: `Next, compare ${staticDuration >= .8 ? `an edit with ${staticRange} cut in half` : `an edit improving the current ${m?.loopSimilarityScore ?? 0}/100 first-to-last match`}.`, commentBaitQuestion: `Which detected transition feels strongest—${cutList}?`, targetHashtags: [formatTag, paceTag, lightTag, '#ReelsEditing', '#VideoAnalysis']
  };

  const p1 = r1(Math.min(3, duration));
  const p2 = r1(Math.min(duration, Math.max(p1 + 1, duration * .55)));
  const guidance: NonNullable<ReelEvaluation['stanceByStanceGuidance']> = [
    { durationRange: `0-${p1}s`, stanceTheme: ko ? `시작 움직임 ${m?.earlyMotionScore ?? 0}/100` : `Opening motion ${m?.earlyMotionScore ?? 0}/100`, optionAHookText: captions.recommendedHooks[0], optionBHookText: captions.recommendedHooks[1], optionCHookText: captions.recommendedHooks[2], onScreenGuidance: ko ? `${sec(openingTime)}의 강한 변화에 맞춰 텍스트를 0.5초 안에 표시하세요.` : `Time the text to the strong change near ${sec(openingTime)} and show it within 0.5s.` },
    { durationRange: `${p1}-${p2}s`, stanceTheme: ko ? `중반 변화 지점 ${dynamicList}` : `Measured change peaks ${dynamicList}`, optionAHookText: ko ? `${sec(strongestTime)}: 이 영상의 최대 변화` : `${sec(strongestTime)}: this upload's largest shift`, optionBHookText: ko ? `${cutList} 중 어디가 가장 강할까요?` : `Which transition is strongest: ${cutList}?`, optionCHookText: ko ? `${staticRange}를 줄이면 리듬이 달라집니다.` : `Tightening ${staticRange} changes the rhythm.`, onScreenGuidance: ko ? `실제 주요 변화 ${cutList}에 맞춰 텍스트를 전환하고, ${staticRange}에는 새 시각 정보를 넣거나 축소하세요.` : `Change text on the measured transitions at ${cutList}; add new visual information at ${staticRange} or shorten that span.` },
    { durationRange: `${p2}-${r1(duration)}s`, stanceTheme: ko ? `후반 변화 ${m?.payoffChangeScore ?? 0}/100` : `Late-stage change ${m?.payoffChangeScore ?? 0}/100`, optionAHookText: ko ? `${sec(payoffTime)}의 마지막 변화 확인` : `Watch the final change near ${sec(payoffTime)}`, optionBHookText: ko ? `첫·끝 유사도 ${m?.loopSimilarityScore ?? 0}/100—자연스럽게 이어지나요?` : `First/last match ${m?.loopSimilarityScore ?? 0}/100—does it loop cleanly?`, optionCHookText: ko ? `마지막 프레임 밝기 ${endingSample?.brightness ?? 0}/100.` : `Final-frame brightness: ${endingSample?.brightness ?? 0}/100.`, onScreenGuidance: ko ? `${sec(payoffTime)} 전후의 실제 후반 변화를 유지하고, 첫 프레임 밝기 ${openingSample?.brightness ?? 0}/100와 마지막 ${endingSample?.brightness ?? 0}/100 차이를 보정하세요.` : `Hold the measured late change near ${sec(payoffTime)} and correct the brightness gap between the first frame (${openingSample?.brightness ?? 0}/100) and last (${endingSample?.brightness ?? 0}/100).` },
  ];

  return {
    id: `eval-${Date.now()}`, title: input.title, durationSeconds: duration, fileFormat: input.fileFormat, fileSizeMb: input.fileSizeMb, niche,
    captionInput: input.captionInput, videoConcept: input.videoConcept, audioType: input.audioType, timestamp: new Date().toISOString(),
    overallStars: stars, overallScorePercent: Math.round(stars * 20), overallVerdict: verdict,
    expectedSkipRatePercent: clamp(Math.round(50 - stars * 7), 12, 65), followerGrowthPotentialPercent: Math.round(stars * 18 + 5), nonFollowerInterestStars: r2(stars * .95), shareabilitySendScore: Math.round(stars * 18.5),
    criticalDefectsIdentified: defects.length ? defects : [ko ? `측정된 시각 신호에서 치명적 결함은 없었습니다. ${evidence}` : `No critical defect was found in the measured visual signals. ${evidence}`],
    aspects: {
      hookStrength: { stars: hook, label: ko ? '0-3초 시각 훅' : 'Measured 0-3s Visual Hook', visualHook: m ? (ko ? `이 파일의 첫 밝기 ${openingSample?.brightness ?? m.brightnessScore}/100, 시작 움직임 ${m.earlyMotionScore}/100, 최대 시작 변화 ${sec(openingTime)}.` : `This file opens at ${openingSample?.brightness ?? m.brightnessScore}/100 brightness with ${m.earlyMotionScore}/100 motion; its strongest early shift is ${sec(openingTime)}.`) : evidence, textHook: noCaption ? (ko ? '업로드 프레임에서 텍스트 의미를 검증할 수 없어 채점에서 제외했습니다.' : 'Text meaning could not be verified from the sampled frames and was excluded from scoring.') : (ko ? `입력 문구 “${input.captionInput}”는 참고 표시만 하며, 업로드 프레임에서 검증된 사실로 취급하지 않습니다.` : `The supplied line “${input.captionInput}” is shown as context only, not treated as verified video evidence.`), audioHook: ko ? '오디오 파형과 음성 의미는 현재 프레임 분석으로 검증되지 않아 채점에서 제외했습니다.' : 'Audio waveform and spoken meaning were not verifiable from frame analysis and were excluded from scoring.', verdict: ko ? `${sec(openingTime)}의 실제 변화가 현재 ${hook}/5 훅 점수의 핵심 근거입니다.` : `The measured change at ${sec(openingTime)} is the primary evidence behind this upload's ${hook}/5 hook score.` },
      pacingAndStimulation: { stars: pacing, label: ko ? '측정된 시각 페이싱' : 'Measured Visual Pacing', avgCutFrequencySec: cutCount ? r1(duration / cutCount) : 0, deadAirDetectedSec: staticDuration, patternInterruptsCount: cutCount, verdict: m ? (ko ? `이 파일의 주요 전환은 ${cutList}; 변화 피크는 ${dynamicList}. 최장 저변화 구간은 ${staticRange} (${sec(staticDuration)})입니다.` : `This file's major transitions are ${cutList}; its strongest measured changes are ${dynamicList}. The longest low-change span is ${staticRange} (${sec(staticDuration)}).`) : evidence },
      narrativeAndPayoff: { stars: narrative, label: ko ? '측정된 시각 전개 & 후반 변화' : 'Measured Visual Progression & Late Change', setupDurationSec: p1, payoffTimingSec: payoffTime, verdict: ko ? `의미나 줄거리는 추정하지 않았습니다. 이 파일의 후반 변화 ${m?.payoffChangeScore ?? 0}/100, 최대 전체 변화 ${sec(strongestTime)}, 최장 정체 ${staticRange}만 반영했습니다.` : `No story meaning was inferred. This score uses only this file's late change (${m?.payoffChangeScore ?? 0}/100), strongest overall shift (${sec(strongestTime)}), and longest hold (${staticRange}).` },
      loopingAndRetention: { stars: loop, label: ko ? '첫·마지막 프레임 연결성' : 'First-to-Last Frame Continuity', seamlessLoopScore: m?.loopSimilarityScore ?? 0, rewatchTriggerPresent: (m?.loopSimilarityScore ?? 0) >= 70, verdict: ko ? `이 파일의 첫/끝 유사도 ${m?.loopSimilarityScore ?? 0}/100; 밝기는 ${openingSample?.brightness ?? 0}→${endingSample?.brightness ?? 0}, 대비는 ${openingSample?.contrast ?? 0}→${endingSample?.contrast ?? 0}입니다.` : `For this file, first/last similarity is ${m?.loopSimilarityScore ?? 0}/100; brightness moves ${openingSample?.brightness ?? 0}→${endingSample?.brightness ?? 0}, and contrast ${openingSample?.contrast ?? 0}→${endingSample?.contrast ?? 0}.` },
      technicalCompliance: { stars: technical, label: ko ? '측정된 영상 품질' : 'Measured Video Quality', watermarkDetected: null, resolutionText: m ? `${m.width} × ${m.height}` : (ko ? '확인 불가' : 'Not verified'), safeZoneViolation: null, captionQuality: ko ? '화면 자막의 의미와 안전지대는 프레임 분석에서 검증되지 않음' : 'On-screen text meaning and safe-zone placement were not verified by frame analysis', verdict: m ? (ko ? `이 파일: ${m.width}×${m.height}, 선명도 ${m.sharpnessScore}/100(최저 ${leastClear?.sharpness ?? 0}/100 @ ${sec(leastClear?.timeSec ?? 0)}), 노출 안정성 ${m.exposureStabilityScore}/100, 최저 밝기 ${darkest?.brightness ?? 0}/100 @ ${sec(darkest?.timeSec ?? 0)}, 암전 ${m.blackFrameRatio}%.` : `This file: ${m.width}×${m.height}; sharpness ${m.sharpnessScore}/100 (low ${leastClear?.sharpness ?? 0}/100 at ${sec(leastClear?.timeSec ?? 0)}), exposure stability ${m.exposureStabilityScore}/100, lowest brightness ${darkest?.brightness ?? 0}/100 at ${sec(darkest?.timeSec ?? 0)}, near-black frames ${m.blackFrameRatio}%.`) : evidence },
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
