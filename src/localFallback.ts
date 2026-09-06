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

  const edits: ReelEvaluation['actionableEdits'] = [];
  if ((m?.earlyMotionScore ?? 0) < 55) edits.push({ id: 'opening', timestampRange: `0-${sec(Math.min(3, duration))}`, type: 'hook', severity: (m?.earlyMotionScore ?? 0) < 18 ? 'critical' : 'recommended', issue: ko ? `첫 3초 움직임 ${m?.earlyMotionScore ?? 0}/100, 시작부 최대 변화는 ${sec(openingTime)}입니다.` : `Opening motion is ${m?.earlyMotionScore ?? 0}/100; the strongest early change is at ${sec(openingTime)}.`, solution: ko ? `${sec(openingTime)}의 변화 장면을 첫 프레임 가까이 당기고 ${subject}의 핵심 결과를 1초 안에 보여주세요.` : `Move the change at ${sec(openingTime)} closer to frame one and reveal the key result of ${subject} within one second.` });
  if (m && staticDuration >= .8) edits.push({ id: 'static', timestampRange: staticRange, type: 'pacing', severity: staticDuration >= 1.5 ? 'critical' : 'recommended', issue: ko ? `${staticRange}가 최장 저변화 구간이며 ${sec(staticDuration)} 지속됩니다.` : `${staticRange} is this upload's longest low-change span, lasting ${sec(staticDuration)}.`, solution: ko ? `이 구간을 ${Math.max(.3, r1(staticDuration / 2))}초 이하로 압축하거나 ${subject}에 관한 새 앵글·동작·정보를 넣으세요.` : `Compress it to ${Math.max(.3, r1(staticDuration / 2))}s or less, or add a new angle, action, or information specific to ${subject}.` });
  if ((m?.payoffChangeScore ?? 0) < 55) edits.push({ id: 'payoff', timestampRange: `${sec(duration * .72)}–${sec(duration)}`, type: 'payoff', severity: (m?.payoffChangeScore ?? 0) < 18 ? 'critical' : 'recommended', issue: ko ? `마지막 15% 변화량은 ${m?.payoffChangeScore ?? 0}/100입니다.` : `Change across the final 15% is ${m?.payoffChangeScore ?? 0}/100.`, solution: ko ? `${sec(payoffTime)} 전후에 ${subject}의 완성 결과를 더 명확하게 유지하고 직전 장면과 대비시키세요.` : `Hold the completed result of ${subject} clearly around ${sec(payoffTime)} and contrast it with the preceding shot.` });
  if ((m?.loopSimilarityScore ?? 0) < 70) edits.push({ id: 'loop', timestampRange: `${sec(duration - Math.min(1.5, duration / 4))}–${sec(duration)}`, type: 'cut', severity: 'recommended', issue: ko ? `첫·마지막 프레임 유사도 ${m?.loopSimilarityScore ?? 0}/100입니다.` : `First-to-last visual similarity is ${m?.loopSimilarityScore ?? 0}/100.`, solution: ko ? `마지막 구도·밝기·피사체 위치를 첫 프레임과 맞춰 시각 루프를 강화하세요.` : `Match the ending composition, brightness, and subject position to frame one to strengthen the visual loop.` });
  if (m && (m.sharpnessScore < 38 || m.exposureStabilityScore < 55)) edits.push({ id: 'quality', timestampRange: `0–${sec(duration)}`, type: 'safezone', severity: 'recommended', issue: ko ? `선명도 ${m.sharpnessScore}/100, 노출 안정성 ${m.exposureStabilityScore}/100입니다.` : `Sharpness is ${m.sharpnessScore}/100 and exposure stability is ${m.exposureStabilityScore}/100.`, solution: ko ? `과도한 압축을 줄이고 노출 변화가 큰 컷을 개별 보정해 ${subject}의 디테일을 일정하게 유지하세요.` : `Reduce aggressive compression and correct unstable shots individually so ${subject} stays consistently detailed.` });
  if (!edits.length) edits.push({ id: 'refine', timestampRange: `${sec(Math.max(0, strongestTime - .5))}–${sec(Math.min(duration, strongestTime + .5))}`, type: 'pacing', severity: 'optional', issue: ko ? `${sec(strongestTime)}에서 최대 시각 변화가 측정됐고 치명적 결함은 없습니다.` : `The strongest visual change is at ${sec(strongestTime)}; no critical measured defect was found.`, solution: ko ? `이 지점을 ${subject}의 핵심 전환점으로 유지하고 주변 컷 리듬만 미세 조정하세요.` : `Keep this as the main turning point for ${subject} and only fine-tune the surrounding cut rhythm.` });

  const safeTag = niche.replace(/[^\p{L}\p{N}]/gu, '');
  const captions: ReelEvaluation['captionOptimization'] = ko ? {
    recommendedHooks: [`${subject}, 결과부터 먼저 보여드릴게요.`, `${subject}에서 가장 크게 달라지는 순간입니다.`, `${subject}의 완성도를 바꾼 한 장면.`],
    valueCTA: `${subject}의 과정과 결과를 비교하고 도움이 됐다면 저장해 두세요.`, cliffhangerCTA: `${subject}의 다음 변화도 같은 방식으로 보여드리겠습니다.`, commentBaitQuestion: `${subject}에서 가장 인상적인 변화는 어느 구간이었나요?`, targetHashtags: [`#${safeTag || '콘텐츠'}`, '#릴스제작', '#숏폼콘텐츠', '#영상편집', '#콘텐츠크리에이터']
  } : {
    recommendedHooks: [`Here is the result of ${subject} first.`, `This is the moment ${subject} changes most.`, `One visual decision changed the finish of ${subject}.`],
    valueCTA: `Compare the process and result of ${subject}, and save this if the breakdown is useful.`, cliffhangerCTA: `The next change to ${subject} will use the same visual breakdown.`, commentBaitQuestion: `Which moment in ${subject} made the strongest visual difference?`, targetHashtags: [`#${safeTag || 'content'}`, '#reelsediting', '#shortformvideo', '#videocreator', '#contentstrategy']
  };

  const p1 = r1(Math.min(3, duration));
  const p2 = r1(Math.min(duration, Math.max(p1 + 1, duration * .55)));
  const guidance: NonNullable<ReelEvaluation['stanceByStanceGuidance']> = [
    { durationRange: `0-${p1}s`, stanceTheme: ko ? `시작 움직임 ${m?.earlyMotionScore ?? 0}/100` : `Opening motion ${m?.earlyMotionScore ?? 0}/100`, optionAHookText: captions.recommendedHooks[0], optionBHookText: captions.recommendedHooks[1], optionCHookText: captions.recommendedHooks[2], onScreenGuidance: ko ? `${sec(openingTime)}의 강한 변화에 맞춰 텍스트를 0.5초 안에 표시하세요.` : `Time the text to the strong change near ${sec(openingTime)} and show it within 0.5s.` },
    { durationRange: `${p1}-${p2}s`, stanceTheme: ko ? `중반 변화 빈도 ${m?.changeFrequencyScore ?? 0}/100` : `Mid-video change frequency ${m?.changeFrequencyScore ?? 0}/100`, optionAHookText: ko ? `${subject}의 핵심 과정` : `The key process behind ${subject}`, optionBHookText: ko ? '여기서 무엇이 달라질까요?' : 'What changes at this point?', optionCHookText: ko ? '가장 큰 차이는 이 장면입니다.' : 'This shot creates the biggest difference.', onScreenGuidance: ko ? `감지된 주요 변화 ${cutCount}개를 기준으로 새 정보가 없는 정적 구간을 줄이세요.` : `With ${cutCount} major visual changes detected, shorten static spans that add no new information.` },
    { durationRange: `${p2}-${r1(duration)}s`, stanceTheme: ko ? `후반 변화 ${m?.payoffChangeScore ?? 0}/100` : `Late-stage change ${m?.payoffChangeScore ?? 0}/100`, optionAHookText: ko ? `${subject}의 최종 결과` : `The final result of ${subject}`, optionBHookText: ko ? '어느 버전이 더 효과적인가요?' : 'Which version works better?', optionCHookText: ko ? '마지막 장면에서 완성됩니다.' : 'It resolves in the final shot.', onScreenGuidance: ko ? `${sec(payoffTime)} 전후에 결과를 충분히 유지하고 마지막 구도를 첫 프레임과 비교하세요.` : `Hold the result around ${sec(payoffTime)} and compare the ending composition with frame one.` },
  ];

  return {
    id: `eval-${Date.now()}`, title: input.title, durationSeconds: duration, fileFormat: input.fileFormat, fileSizeMb: input.fileSizeMb, niche,
    captionInput: input.captionInput, videoConcept: input.videoConcept, audioType: input.audioType, timestamp: new Date().toISOString(),
    overallStars: stars, overallScorePercent: Math.round(stars * 20), overallVerdict: verdict,
    expectedSkipRatePercent: clamp(Math.round(50 - stars * 7), 12, 65), followerGrowthPotentialPercent: Math.round(stars * 18 + 5), nonFollowerInterestStars: r2(stars * .95), shareabilitySendScore: Math.round(stars * 18.5),
    criticalDefectsIdentified: defects.length ? defects : [ko ? `측정된 시각 신호에서 치명적 결함은 없었습니다. ${evidence}` : `No critical defect was found in the measured visual signals. ${evidence}`],
    aspects: {
      hookStrength: { stars: hook, label: ko ? '0-3초 시각 훅' : 'Measured 0-3s Visual Hook', visualHook: m ? (ko ? `첫 3초 움직임 ${m.earlyMotionScore}/100, 대비 ${m.contrastScore}/100, 최대 시작 변화 ${sec(openingTime)}.` : `Opening motion ${m.earlyMotionScore}/100, contrast ${m.contrastScore}/100, strongest early change at ${sec(openingTime)}.`) : evidence, textHook: noCaption ? (ko ? '입력 캡션 없음; 텍스트 효과는 채점하지 않았습니다.' : 'No supplied caption; text effectiveness was not scored.') : (ko ? `입력 캡션: “${input.captionInput}”` : `Supplied caption: “${input.captionInput}”`), audioHook: ko ? `선택 오디오 설명: ${input.audioType || '없음'}. 실제 파형은 미검증입니다.` : `Selected audio description: ${input.audioType || 'none'}. The waveform was not verified.`, verdict: ko ? '현재 업로드의 측정된 시작 신호만 반영했습니다.' : 'Based only on measured opening signals from this upload.' },
      pacingAndStimulation: { stars: pacing, label: ko ? '측정된 시각 페이싱' : 'Measured Visual Pacing', avgCutFrequencySec: cutCount ? r1(duration / cutCount) : 0, deadAirDetectedSec: staticDuration, patternInterruptsCount: cutCount, verdict: m ? (ko ? `변화 빈도 ${m.changeFrequencyScore}/100, 움직임 ${m.motionScore}/100, 주요 변화 ${cutCount}개, 최장 정체 ${sec(staticDuration)}.` : `Change frequency ${m.changeFrequencyScore}/100, motion ${m.motionScore}/100, ${cutCount} major changes, longest hold ${sec(staticDuration)}.`) : evidence },
      narrativeAndPayoff: { stars: narrative, label: ko ? '측정된 전개 & 결과 강조' : 'Measured Progression & Payoff', setupDurationSec: p1, payoffTimingSec: payoffTime, verdict: ko ? `${noConcept ? '기획 의도 미입력; ' : `기획 의도 “${input.videoConcept}”; `}후반 변화 ${m?.payoffChangeScore ?? 0}/100, 최대 전체 변화 ${sec(strongestTime)}.` : `${noConcept ? 'No creative intent supplied; ' : `Intent: “${input.videoConcept}”; `}late-stage change ${m?.payoffChangeScore ?? 0}/100, strongest overall change at ${sec(strongestTime)}.` },
      loopingAndRetention: { stars: loop, label: ko ? '첫·마지막 프레임 연결성' : 'First-to-Last Frame Continuity', seamlessLoopScore: m?.loopSimilarityScore ?? 0, rewatchTriggerPresent: (m?.loopSimilarityScore ?? 0) >= 70, verdict: ko ? `첫·마지막 샘플 프레임 유사도 ${m?.loopSimilarityScore ?? 0}/100. 오디오 루프는 미검증입니다.` : `First-to-last sampled-frame similarity is ${m?.loopSimilarityScore ?? 0}/100. Audio looping was not verified.` },
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
