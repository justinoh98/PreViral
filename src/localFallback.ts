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
  const subject = (input.videoConcept || input.title || niche).trim();
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
  const activeVideo = (m?.changeFrequencyScore ?? 0) >= 55;
  const highContrast = (m?.contrastScore ?? 0) >= 55;
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
  edits.push({
    id: 'written-hook', timestampRange: 'Opening frame', type: 'hook', severity: 'recommended',
    issue: ko ? `첫 프레임에서 ${subject}의 핵심을 읽을 수 있는 짧은 문구가 필요합니다.` : `The first frame needs a short line that immediately frames ${subject}.`,
    solution: ko
      ? `화면 중앙에 “${activeVideo ? `${subject}, 놓치면 다시 봐야 합니다` : `${subject}, 무엇이 달라졌을까요?`}”를 표시하세요. 흰색 굵은 글자, 2줄 이내, 어두운 반투명 배경을 사용하세요.`
      : `Place “${activeVideo ? `${subject} — don't blink` : `What changed in ${subject}?`}” in the center. Use bold white type, no more than two lines, on a dark translucent plate.`
  });
  edits.push({
    id: 'transition-style', timestampRange: 'Between key shots', type: 'cut', severity: 'recommended',
    issue: ko ? `현재 화면 변화량에는 일관된 전환 규칙이 필요합니다.` : `The measured visual changes need one consistent transition rule.`,
    solution: ko
      ? `${activeVideo ? '효과 전환을 빼고 움직임이 이어지는 하드컷 또는 매치컷을 사용하세요.' : '정적인 장면 사이에 5–8% 펀치인 줌과 짧은 디졸브를 한 번씩만 사용하세요.'} 가장 큰 변화 장면에는 화면 텍스트 “핵심 변화”를 0.7초 표시하세요.`
      : `${activeVideo ? 'Remove decorative transitions; use hard cuts or motion-matched cuts.' : 'Use a 5–8% punch-in and one short dissolve between quieter shots.'} Label the strongest visual change with “Key change” for 0.7s.`
  });
  if ((m?.earlyMotionScore ?? 0) < 55) edits.push({ id: 'opening', timestampRange: `0-${sec(Math.min(3, duration))}`, type: 'hook', severity: (m?.earlyMotionScore ?? 0) < 18 ? 'critical' : 'recommended', issue: ko ? `첫 화면의 움직임이 약해 변화가 시작되기 전에 이탈할 수 있습니다.` : `The opening frame changes too slowly, so viewers may leave before the visual action begins.`, solution: ko ? `첫 화면을 ${sec(openingTime)}의 변화 컷으로 교체하고, 중앙에 “무엇이 달라졌을까요?”를 크게 표시하세요. 텍스트는 5–8단어, 흰색 볼드체와 어두운 반투명 배경을 사용하세요.` : `Replace the first frame with the stronger change shot and overlay “What changed here?” in the center. Keep it to 3–6 words, using bold white text on a dark translucent plate.` });
  if (m && staticDuration >= .8) edits.push({ id: 'static', timestampRange: staticRange, type: 'pacing', severity: staticDuration >= 1.5 ? 'critical' : 'recommended', issue: ko ? `같은 화면이 오래 유지되어 시각적 진행이 멈춰 보입니다.` : `One visual state holds too long, making the reel feel paused rather than progressing.`, solution: ko ? `이 홀드 구간을 점프컷으로 절반 이하로 줄이세요. 컷을 유지해야 한다면 5–8% 펀치인 줌 또는 다른 앵글을 넣고, 화면 텍스트를 “여기서 달라집니다”로 교체하세요.` : `Cut this hold by at least half with a jump cut. If it must remain, add a 5–8% punch-in or alternate angle and use the on-screen line “Here’s what changes.”` });
  if ((m?.payoffChangeScore ?? 0) < 55) edits.push({ id: 'payoff', timestampRange: `${sec(duration * .72)}–${sec(duration)}`, type: 'payoff', severity: (m?.payoffChangeScore ?? 0) < 18 ? 'critical' : 'recommended', issue: ko ? `마지막 화면이 앞 장면과 충분히 구분되지 않아 결과가 약하게 보입니다.` : `The ending does not separate clearly enough from the preceding visuals, weakening the result.` , solution: ko ? `가장 변화가 큰 장면과 마지막 결과를 하드컷으로 대비시키고, 결과 프레임을 0.6–1초 유지하세요. 화면에는 “최종 결과” 또는 “전 / 후”만 표시하세요.` : `Hard-cut from the strongest-change shot to the final result and hold that result for 0.6–1s. Use only “Final result” or “Before / After” on screen.` });
  if ((m?.loopSimilarityScore ?? 0) < 70) edits.push({ id: 'loop', timestampRange: `${sec(duration - Math.min(1.5, duration / 4))}–${sec(duration)}`, type: 'cut', severity: 'recommended', issue: ko ? `첫 화면과 마지막 화면의 구도·밝기 차이가 커서 반복 재생 시 끊겨 보입니다.` : `The first and final frames differ enough in composition and brightness to make replay feel abrupt.`, solution: ko ? `마지막 컷을 첫 프레임과 같은 크롭과 피사체 위치로 맞추고, 밝기를 첫 화면 수준으로 보정한 뒤 매치컷으로 연결하세요.` : `Re-crop the final shot to match the first frame’s subject position, match its brightness, and connect them with a match cut.` });
  if (m && (m.sharpnessScore < 38 || m.exposureStabilityScore < 55)) edits.push({ id: 'quality', timestampRange: `0–${sec(duration)}`, type: 'safezone', severity: 'recommended', issue: ko ? `이 파일의 평균 선명도는 ${m.sharpnessScore}/100, 노출 안정성은 ${m.exposureStabilityScore}/100입니다.` : `This file measures ${m.sharpnessScore}/100 average sharpness and ${m.exposureStabilityScore}/100 exposure stability.`, solution: ko ? `전체 보정보다 ${sec(leastClear?.timeSec ?? 0)}의 선명도 ${leastClear?.sharpness ?? m.sharpnessScore}/100 구간과 ${sec(darkest?.timeSec ?? 0)}의 밝기 ${darkest?.brightness ?? m.brightnessScore}/100 구간을 각각 보정하세요.` : `Instead of a global correction, separately adjust the ${leastClear?.sharpness ?? m.sharpnessScore}/100 sharpness point at ${sec(leastClear?.timeSec ?? 0)} and the ${darkest?.brightness ?? m.brightnessScore}/100 brightness point at ${sec(darkest?.timeSec ?? 0)}.` });
  if (leastClear && leastClear.sharpness < 40) edits.push({ id: 'clarity-point', timestampRange: `${sec(Math.max(0, leastClear.timeSec - .4))}–${sec(Math.min(duration, leastClear.timeSec + .4))}`, type: 'safezone', severity: leastClear.sharpness < 25 ? 'critical' : 'recommended', issue: ko ? `이 업로드에서 가장 흐린 측정 지점은 ${sec(leastClear.timeSec)}이며 선명도 ${leastClear.sharpness}/100입니다.` : `This upload's least-clear measured point is ${sec(leastClear.timeSec)} at ${leastClear.sharpness}/100 sharpness.`, solution: ko ? `이 0.8초 구간만 별도로 선명화하거나 더 또렷한 원본 프레임으로 교체하세요. 전체 영상에 일괄 샤픈을 적용하지 마세요.` : `Sharpen only this 0.8s interval or replace it with a clearer source frame; do not apply blanket sharpening to the full reel.` });
  if (!edits.length) edits.push({ id: 'refine', timestampRange: `${sec(Math.max(0, strongestTime - .5))}–${sec(Math.min(duration, strongestTime + .5))}`, type: 'pacing', severity: 'optional', issue: ko ? `${sec(strongestTime)}에서 이 파일의 최대 시각 변화가 측정됐고 치명적 결함은 없습니다.` : `This file's strongest visual change occurs at ${sec(strongestTime)}; no critical measured defect was found.`, solution: ko ? `이 변화 전후 0.5초의 컷 길이는 유지하고, 다른 구간만 조정해 현재 리듬 피크를 보존하세요.` : `Preserve the half-second on each side of this transition and adjust other intervals so this upload's rhythm peak remains intact.` });
  edits.push({
    id: 'payoff-card', timestampRange: 'Final result frame', type: 'payoff', severity: 'recommended',
    issue: ko ? `마지막 장면에는 ${subject}의 결과를 즉시 이해시키는 마감 문구가 필요합니다.` : `The ending needs a clear finish line that explains the result of ${subject} at a glance.`,
    solution: ko
      ? `마지막 결과 프레임을 0.8초 유지하고 “${subject} — 최종 결과”를 표시하세요. 그 아래 작은 글씨로 “어떤 변화가 가장 좋았나요?”를 넣으세요.`
      : `Hold the final result for 0.8s and overlay “${subject} — final result.” Add “Which change worked best?” underneath in smaller text.`
  });

  const paceTag = (m?.changeFrequencyScore ?? 0) >= 55 ? (ko ? '#빠른컷편집' : '#FastCutEditing') : (ko ? '#슬로우페이스영상' : '#SlowPacedVideo');
  const lightTag = (m?.contrastScore ?? 0) >= 55 ? (ko ? '#고대비영상' : '#HighContrastVideo') : (ko ? '#소프트톤영상' : '#SoftToneVideo');
  const formatTag = m && m.height > m.width ? (ko ? '#세로형영상' : '#VerticalVideo') : (ko ? '#가로형영상' : '#LandscapeVideo');
  const captions: ReelEvaluation['captionOptimization'] = ko ? {
    recommendedHooks: [activeVideo ? `${subject}, 놓치면 다시 봐야 합니다.` : `${subject}, 작은 차이를 찾아보세요.`, highContrast ? `${subject}: 빛과 그림자가 바뀌는 순간.` : `${subject}에서 가장 먼저 달라진 디테일은?`, (m?.payoffChangeScore ?? 0) < 55 ? `${subject}의 최종 결과부터 공개합니다.` : `끝까지 보면 ${subject}의 첫 장면이 다르게 보입니다.`],
    valueCTA: `${subject}에서 가장 효과적인 화면 변화를 골라 저장해 두세요.`, cliffhangerCTA: `다음 영상에서는 ${subject}의 ${staticDuration >= .8 ? '더 빠르게 편집한 버전' : '더 자연스럽게 반복되는 버전'}을 비교해 보여드리겠습니다.`, commentBaitQuestion: `${subject}에서 가장 먼저 눈에 들어온 것은 구도, 움직임, 밝기 중 무엇인가요?`, targetHashtags: [formatTag, paceTag, lightTag, `#${niche.replace(/[^\p{L}\p{N}]/gu, '') || '콘텐츠'}`, '#릴스편집']
  } : {
    recommendedHooks: [activeVideo ? `${subject} — don't blink.` : `${subject}: spot the small difference.`, highContrast ? `${subject}: watch the light and shadow shift.` : `Which detail changes first in ${subject}?`, (m?.payoffChangeScore ?? 0) < 55 ? `See the final result of ${subject} first.` : `The ending changes how the opening of ${subject} looks.`],
    valueCTA: `Choose the strongest visual change in ${subject} and save this for reference.`, cliffhangerCTA: `Next, compare ${staticDuration >= .8 ? `a faster-cut version of ${subject}` : `a smoother-looping version of ${subject}`}.`, commentBaitQuestion: `What caught your eye first in ${subject}: composition, movement, or lighting?`, targetHashtags: [formatTag, paceTag, lightTag, `#${niche.replace(/[^\p{L}\p{N}]/gu, '') || 'Content'}`, '#ReelsEditing']
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
      hookStrength: { stars: hook, label: ko ? '0-3초 시각 훅' : 'Measured 0-3s Visual Hook', visualHook: m ? (ko ? `추천 화면: 가장 강한 변화 컷을 첫 장면으로 사용하고 중앙에 “${subject}, 무엇이 달라졌을까요?”를 표시하세요.` : `Visible recommendation: open on the strongest change shot and center “What changed in ${subject}?” over it.`) : evidence, textHook: ko ? `추천 문구: “${activeVideo ? `${subject}, 놓치면 다시 봐야 합니다` : `${subject}, 작은 차이를 찾아보세요`}”` : `Suggested hook: “${activeVideo ? `${subject} — don't blink` : `${subject}: spot the difference`}.”`, audioHook: ko ? '오디오는 화면 전환 순간에 비트나 효과음을 맞추세요. 실제 파형은 현재 분석에서 확인되지 않았습니다.' : 'Align a beat or sound accent with the visible transition; the actual waveform was not verified.', verdict: ko ? `${activeVideo ? '빠른 화면 변화에는 하드컷과 짧은 문구가 적합합니다.' : '느린 화면 변화에는 펀치인 줌과 질문형 문구가 적합합니다.'}` : `${activeVideo ? 'Use hard cuts and a short statement for this fast-changing visual style.' : 'Use a punch-in and question hook for this slower visual style.'}` },
      pacingAndStimulation: { stars: pacing, label: ko ? '측정된 시각 페이싱' : 'Measured Visual Pacing', avgCutFrequencySec: cutCount ? r1(duration / cutCount) : 0, deadAirDetectedSec: staticDuration, patternInterruptsCount: cutCount, verdict: m ? (ko ? `${activeVideo ? '장식 전환을 제거하고 움직임이 이어지는 하드컷을 사용하세요.' : '정적인 컷에는 5–8% 펀치인 줌이나 다른 앵글을 추가하세요.'} 가장 긴 홀드에는 “여기서 달라집니다”를 표시하세요.` : `${activeVideo ? 'Remove decorative transitions and use motion-matched hard cuts.' : 'Add a 5–8% punch-in or alternate angle to quiet shots.'} Label the longest hold “Here’s what changes.”`) : evidence },
      narrativeAndPayoff: { stars: narrative, label: ko ? '측정된 시각 전개 & 후반 변화' : 'Measured Visual Progression & Late Change', setupDurationSec: p1, payoffTimingSec: payoffTime, verdict: ko ? `마지막 결과 프레임에 “${subject} — 최종 결과”를 쓰고 0.8초 유지하세요. 직전 장면과는 하드컷으로 구분하세요.` : `Write “${subject} — final result” on the ending frame, hold it for 0.8s, and separate it from the preceding shot with a hard cut.` },
      loopingAndRetention: { stars: loop, label: ko ? '첫·마지막 프레임 연결성' : 'First-to-Last Frame Continuity', seamlessLoopScore: m?.loopSimilarityScore ?? 0, rewatchTriggerPresent: (m?.loopSimilarityScore ?? 0) >= 70, verdict: ko ? `${(m?.loopSimilarityScore ?? 0) < 70 ? '마지막 컷을 첫 프레임과 같은 크롭·밝기로 맞추고 매치컷으로 연결하세요.' : '현재 첫·끝 구도를 유지하고 마지막 문구를 첫 훅 질문에 답하도록 구성하세요.'}` : `${(m?.loopSimilarityScore ?? 0) < 70 ? 'Match the final crop and brightness to frame one, then connect with a match cut.' : 'Keep the current first/last composition and make the final line answer the opening hook.'}` },
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
