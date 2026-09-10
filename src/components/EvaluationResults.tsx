import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Award,
  Zap,
  TrendingUp,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Scissors,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  ShieldCheck,
  MessageCircle,
  Hash,
  RefreshCw,
  Lightbulb,
  Info,
  AlertCircle,
} from 'lucide-react';
import { ReelEvaluation } from '../types';
import { StarRating } from './StarRating';
import { useLanguage } from '../i18n';
import { createLocalCaptions } from '../localFallback';
import { EditPlan } from '../evaluation/EditPlan';
import { WhatISaw } from '../evaluation/WhatISaw';
import type { Aspect } from '../../evaluation/contracts';

function AspectEvidence({ evaluation, aspect, language }: { evaluation: ReelEvaluation; aspect: Aspect; language: string }) {
  const evidence = evaluation.aspectEvidence?.[aspect];
  const inventory = evaluation.grounding?.inventory;
  if (!evidence || !inventory) return null;
  return <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600"><strong className="text-slate-800">{language === 'ko' ? '실제 영상 근거' : 'In your video'}</strong><ul className="list-disc pl-4">{evidence.sceneIds.map(id => <li key={id}>{inventory.scenes.find(s => s.id === id)?.description}</li>)}</ul><p>{evidence.interpretation}</p><p><strong>{evaluation.niche}: </strong>{evidence.nicheReason}</p></div>;
}

interface EvaluationResultsProps {
  evaluation: ReelEvaluation;
  onReEvaluate: () => void;
}

export const EvaluationResults: React.FC<EvaluationResultsProps> = ({
  evaluation,
  onReEvaluate,
}) => {
  const { t, language } = useLanguage();
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showCaptionsGenerator, setShowCaptionsGenerator] = useState<boolean>(false);
  const [customTopic, setCustomTopic] = useState<string>(evaluation.videoConcept || evaluation.title || '');
  const [generatedCaptions, setGeneratedCaptions] = useState<any>(null);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState<boolean>(false);

  // Trigger confetti celebration on high score!
  useEffect(() => {
    if (evaluation.overallStars >= (evaluation.evaluatorVersion ? 4.4 : 4.2)) {
      try {
        const confettiInstance = confetti.create(undefined, {
          useWorker: false,
          resize: true,
        });
        confettiInstance({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (err) {
        console.warn('Confetti effect error prevented:', err);
      }
    }
  }, [evaluation]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleGenerateCaptions = async () => {
    setIsGeneratingCaptions(true);
    try {
      const res = await fetch('/api/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: customTopic,
          niche: evaluation.niche,
          tone: 'engaging',
          language,
        }),
      });
      const data = res.ok
        ? await res.json()
        : createLocalCaptions(customTopic, evaluation.niche, language);
      setGeneratedCaptions(data);
    } catch (e) {
      setGeneratedCaptions(createLocalCaptions(customTopic, evaluation.niche, language));
    } finally {
      setIsGeneratingCaptions(false);
    }
  };

  // Localized Verdict display helper
  const getVerdictLabel = (verdict: string) => {
    if (language !== 'ko') return verdict;
    switch (verdict) {
      case 'Viral Contender':
        return '바이럴 후보';
      case 'Strong Growth':
        return '우수한 성장세';
      case 'Moderate Retention':
        return '보통 수준 유지';
      case 'High Skip Risk':
        return '높은 이탈 위험';
      default:
        return verdict;
    }
  };

  // Verdict badge colors
  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'Viral Contender':
      case '바이럴 후보':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'Strong Growth':
      case '우수한 성장세':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Moderate Retention':
      case '보통 수준 유지':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-rose-100 text-rose-700 border-rose-200';
    }
  };

  const getSeverityLabel = (sev: string) => {
    if (language !== 'ko') return sev;
    if (sev === 'critical') return '치명적 결함';
    if (sev === 'recommended') return '권장 개선';
    return '미세 조정';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Overall Evaluation Hero Header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden text-slate-800">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          {/* Left: Overall Quality Score */}
          <div className="flex flex-col min-[420px]:flex-row items-start min-[420px]:items-center gap-4 sm:gap-5 min-w-0">
            <div className="flex flex-col items-center justify-center bg-slate-50 border border-gray-200 rounded-2xl p-4 shadow-sm min-w-[120px]">
              <span className="text-4xl font-extrabold text-slate-900 font-sans tracking-tight">
                {evaluation.overallStars.toFixed(1)}
              </span>
              <StarRating rating={evaluation.overallStars} size="sm" showNumeric={false} className="mt-1" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {t('outOf5')}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getVerdictBadge(evaluation.overallVerdict)}`}>
                  {getVerdictLabel(evaluation.overallVerdict)}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {t('overallScoreLabel')}{' '}
                  <span className="text-indigo-600 font-extrabold">{evaluation.overallScorePercent}%</span>
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {evaluation.title || (language === 'ko' ? '진단된 릴스' : 'Evaluated Reel')}
              </h2>
              <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                <span>{evaluation.niche}</span>
                <span>•</span>
                <span>{evaluation.durationSeconds}{language === 'ko' ? '초 재생' : 's duration'}</span>
                <span>•</span>
                <span>{evaluation.fileFormat}</span>
                {evaluation.versionTag && (
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold border border-indigo-100">
                    {evaluation.versionTag}
                  </span>
                )}
                {evaluation.isCachedEvaluation && (
                  <span
                    className="px-2.5 py-0.5 bg-amber-50 text-amber-800 rounded text-[10px] font-bold border border-amber-200 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3 text-amber-600" />
                    {language === 'ko' ? '동일 영상 고정 평점' : 'Static Rating (Exact Match)'}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold border border-slate-200">
                  {language === 'ko' ? '가중치 루브릭 적용' : 'Objective Weighted Rubric'}
                </span>
              </p>
              <p className="text-[11px] font-semibold text-slate-400">
                {language === 'ko' ? '평가 척도: 0점 최악 · 5점 탁월하고 완성도 높음' : 'Rating scale: 0 = horrible · 5 = outstanding and polished'}
              </p>

              {evaluation.videoConcept && (
                <div className="mt-2 text-xs text-slate-700 bg-amber-50/70 border border-amber-200/80 rounded-xl px-3 py-2 flex items-start gap-2 max-w-2xl">
                  <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-900 block text-[11px]">
                      {language === 'ko' ? '기획 의도 및 핵심 컨셉:' : 'Video Concept & Creative Intent:'}
                    </span>
                    <span className="text-slate-700 leading-relaxed">{evaluation.videoConcept}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
            <button
              onClick={onReEvaluate}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <RotateCcw className="w-4 h-4 text-slate-600" />
              {t('reEvaluateTest')}
            </button>
            <button
              onClick={() => setShowCaptionsGenerator(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100"
            >
              <Sparkles className="w-4 h-4" />
              {t('generateCaptionsBtn')}
            </button>
          </div>
        </div>

        {/* Upload-specific editorial verdict, matching the requested long-form feedback style */}
        {(evaluation.executiveSummary || evaluation.observedStrengths?.length || evaluation.observedWeaknesses?.length) && (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-extrabold tracking-tight flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-300" />
                  {language === 'ko' ? '업로드 영상 최종 판정' : 'Upload-Specific Auditor Verdict'}
                </h3>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-slate-300">
                  {language === 'ko' ? '사람 중심 시각 리뷰' : 'Human-first visual review'}
                </span>
              </div>
              <p className="text-sm leading-6 text-slate-200">
                {evaluation.executiveSummary}
              </p>
              {evaluation.evidenceSummary?.limitations?.length ? (
                <div className="mt-3 border-t border-slate-800 pt-3 text-[11px] leading-5 text-slate-400">
                  <strong className="text-slate-300">{language === 'ko' ? '검증 한계:' : 'Verification limits:'}</strong>{' '}
                  {evaluation.evidenceSummary.limitations.join(' · ')}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <h4 className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="w-4 h-4" /> {language === 'ko' ? '실제로 잘 작동하는 점' : 'What Actually Works'}
                </h4>
                <ul className="space-y-1.5 text-xs leading-5 text-emerald-950">
                  {(evaluation.observedStrengths || []).map((item, index) => <li key={index}>• {item}</li>)}
                </ul>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <h4 className="text-xs font-extrabold text-rose-900 flex items-center gap-1.5 mb-2">
                  <AlertCircle className="w-4 h-4" /> {language === 'ko' ? '이탈을 만드는 약점' : 'What Causes Drop-Off'}
                </h4>
                <ul className="space-y-1.5 text-xs leading-5 text-rose-950">
                  {(evaluation.observedWeaknesses || []).map((item, index) => <li key={index}>• {item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Objective Critical Defects Identified */}
        {evaluation.criticalDefectsIdentified && evaluation.criticalDefectsIdentified.length > 0 && (
          <div className="mt-4 bg-rose-50/90 border border-rose-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{t('defectsTitle')} ({evaluation.criticalDefectsIdentified.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-rose-950 font-medium">
              {evaluation.criticalDefectsIdentified.map((defect, i) => (
                <div key={i} className="flex items-start gap-2 bg-white/90 p-2.5 rounded-xl border border-rose-200 shadow-2xs">
                  <span className="text-rose-600 font-bold shrink-0">•</span>
                  <span>{defect}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Key Metrics Bar */}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-gray-100">
          {/* Expected Skip Rate */}
          <div className="bg-slate-50/80 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
              <span>{t('expectedSkipRate')}</span>
              <Zap className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${evaluation.expectedSkipRatePercent <= 20 ? 'text-green-600' : 'text-amber-600'}`}>
                {evaluation.prediction ? `${evaluation.prediction.low}–${evaluation.prediction.high}%` : `${evaluation.expectedSkipRatePercent}%`}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {evaluation.prediction ? (language === 'ko' ? '참고용 추정 범위 · 실제 성과 아님' : 'Heuristic range · not actual performance') : (evaluation.expectedSkipRatePercent <= 20 ? t('lowSkipOptimal') : t('moderateSkipRisk'))}
              </span>
            </div>
          </div>

          {/* Unconnected Reach / Follower Potential */}
          <div className="bg-slate-50/80 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
              <span>{evaluation.evaluatorVersion ? (language === 'ko' ? '팔로우 전환 잠재력' : 'Follow potential index') : t('reachForecast')}</span>
              <TrendingUp className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-indigo-600">
                {evaluation.followerGrowthPotentialPercent > 60
                  ? (language === 'ko' ? '높음' : 'High')
                  : (language === 'ko' ? '보통' : 'Moderate')}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {evaluation.followerGrowthPotentialPercent == null ? '—' : `${evaluation.followerGrowthPotentialPercent}${evaluation.evaluatorVersion ? '/100' : '%'}`} {evaluation.evaluatorVersion ? '' : t('potential')}
              </span>
            </div>
          </div>

          {/* Non-Follower Interest */}
          <div className="bg-slate-50/80 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
              <span>{t('nonFollowerInterest')}</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {evaluation.nonFollowerInterestStars == null ? '—' : evaluation.nonFollowerInterestStars.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">{t('starsMax')}</span>
            </div>
          </div>

          {/* DM Shareability */}
          <div className="bg-slate-50/80 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
              <span>{t('dmSendFactor')}</span>
              <Share2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-indigo-600">
                {evaluation.shareabilitySendScore == null ? '—' : `${evaluation.shareabilitySendScore}/100`}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">{evaluation.evaluatorVersion ? (language === 'ko' ? '잠재력 지수' : 'potential index') : t('shareRate')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 5-Star Critical Aspect Rating Matrix */}
      {evaluation.grounding && <WhatISaw report={evaluation.grounding} language={language} />}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" /> {language === 'ko' ? '5가지 영상 품질 리뷰' : 'Five-Part Visual Quality Review'}
            </h3>
            <p className="text-xs text-slate-500">{t('aspectMatrixSub')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Pillar 1: Zero-Second Hook */}
          <div className="bg-slate-50/60 border border-gray-100 rounded-2xl p-5 flex flex-col justify-between hover:border-gray-200 transition-colors">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-extrabold uppercase">
                  {language === 'ko' ? '첫인상' : 'Opening impression'}
                </span>
                <StarRating rating={evaluation.aspects.hookStrength.stars} size="sm" />
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1">
                {language === 'ko' ? '0초 스크롤 방지 훅' : evaluation.aspects.hookStrength.label}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                {evaluation.aspects.hookStrength.verdict}
              </p>
            </div>
            <div className="space-y-2 text-xs leading-5 bg-white p-3 rounded-xl border border-gray-100 text-slate-600">
              <div><strong className="text-slate-800">{language === 'ko' ? '시각 훅:' : 'Visual:'}</strong> {evaluation.aspects.hookStrength.visualHook}</div>
              <div><strong className="text-slate-800">{language === 'ko' ? '자막 훅:' : 'Text:'}</strong> {evaluation.aspects.hookStrength.textHook}</div>
              <AspectEvidence evaluation={evaluation} aspect="hookStrength" language={language} />
            </div>
          </div>

          {/* Pillar 2: Pacing & Pattern Interrupts */}
          <div className="bg-slate-50/60 border border-gray-100 rounded-2xl p-5 flex flex-col justify-between hover:border-gray-200 transition-colors">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] font-extrabold uppercase">
                  {language === 'ko' ? '화면 흐름' : 'Visual flow'}
                </span>
                <StarRating rating={evaluation.aspects.pacingAndStimulation.stars} size="sm" />
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1">
                {language === 'ko' ? '화면 전환 및 페이싱' : evaluation.aspects.pacingAndStimulation.label}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                {evaluation.aspects.pacingAndStimulation.verdict}
              </p>
            </div>
            <div className="text-xs leading-5 bg-white p-3 rounded-xl border border-gray-100 text-slate-600">
              <strong className="text-slate-800">{language === 'ko' ? '시청자가 느끼는 점: ' : 'What a viewer notices: '}</strong>
              {evaluation.editPlan?.aspectNotes.pacingAndStimulation.detail || evaluation.aspects.pacingAndStimulation.verdict}
              <AspectEvidence evaluation={evaluation} aspect="pacingAndStimulation" language={language} />
            </div>
          </div>

          {/* Pillar 3: Narrative Arc & Payoff */}
          <div className="bg-slate-50/60 border border-gray-100 rounded-2xl p-5 flex flex-col justify-between hover:border-gray-200 transition-colors">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-extrabold uppercase">
                  {language === 'ko' ? '이야기와 결과' : 'Story and payoff'}
                </span>
                <StarRating rating={evaluation.aspects.narrativeAndPayoff.stars} size="sm" />
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1">
                {language === 'ko' ? '스토리 전개 및 결말 피날레' : evaluation.aspects.narrativeAndPayoff.label}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                {evaluation.aspects.narrativeAndPayoff.verdict}
              </p>
            </div>
            <div className="text-xs leading-5 bg-white p-3 rounded-xl border border-gray-100 text-slate-600">
              <strong className="text-slate-800">{language === 'ko' ? '시청자가 느끼는 점: ' : 'What a viewer notices: '}</strong>
              {evaluation.editPlan?.aspectNotes.narrativeAndPayoff.detail || evaluation.aspects.narrativeAndPayoff.verdict}
              <AspectEvidence evaluation={evaluation} aspect="narrativeAndPayoff" language={language} />
            </div>
          </div>

          {/* Pillar 4: Looping & Retention */}
          <div className="bg-slate-50/60 border border-gray-100 rounded-2xl p-5 flex flex-col justify-between hover:border-gray-200 transition-colors">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-extrabold uppercase">
                  {language === 'ko' ? '다시 보기' : 'Replay appeal'}
                </span>
                <StarRating rating={evaluation.aspects.loopingAndRetention.stars} size="sm" />
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1">
                {language === 'ko' ? '반복 재생(루프) 자연스러움' : evaluation.aspects.loopingAndRetention.label}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                {evaluation.aspects.loopingAndRetention.verdict}
              </p>
            </div>
            <div className="text-xs leading-5 bg-white p-3 rounded-xl border border-gray-100 text-slate-600">
              <strong className="text-slate-800">{language === 'ko' ? '시청자가 느끼는 점: ' : 'What a viewer notices: '}</strong>
              {evaluation.editPlan?.aspectNotes.loopingAndRetention.detail || evaluation.aspects.loopingAndRetention.verdict}
              <AspectEvidence evaluation={evaluation} aspect="loopingAndRetention" language={language} />
            </div>
          </div>

          {/* Pillar 5: Technical Compliance */}
          <div className="bg-slate-50/60 border border-gray-100 rounded-2xl p-5 flex flex-col justify-between hover:border-gray-200 transition-colors md:col-span-2 lg:col-span-2">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-100 rounded text-[10px] font-extrabold uppercase">
                  {language === 'ko' ? '모바일 화면 완성도' : 'Mobile visual polish'}
                </span>
                <StarRating rating={evaluation.aspects.technicalCompliance.stars} size="sm" />
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1">
                {language === 'ko' ? '기술 규격 및 자막 안전지대' : evaluation.aspects.technicalCompliance.label}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                {evaluation.aspects.technicalCompliance.verdict}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs leading-5 bg-white p-3 rounded-xl border border-gray-100 text-slate-600">
              <div><strong className="text-slate-800">{language === 'ko' ? '화면: ' : 'Picture: '}</strong> {evaluation.aspects.technicalCompliance.resolutionText}</div>
              <div><strong className="text-slate-800">{language === 'ko' ? '문구 배치: ' : 'Copy placement: '}</strong> {evaluation.aspects.technicalCompliance.captionQuality}</div>
              <div className="sm:col-span-2"><AspectEvidence evaluation={evaluation} aspect="technicalCompliance" language={language} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Copy-ready overlay language without timing or effect jargon. */}
      {evaluation.stanceByStanceGuidance && evaluation.stanceByStanceGuidance.length > 0 && (
        <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1.5 bg-indigo-600/30 border border-indigo-500/40 text-amber-400 rounded-lg">
                  <Zap className="w-5 h-5 fill-amber-400" />
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {t('playbookTitle')}
                </h3>
                <span className="px-2.5 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded text-[10px] font-extrabold uppercase tracking-wider">
                  {t('playbookBadge')}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {t('playbookDesc')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evaluation.stanceByStanceGuidance.map((stance, idx) => (
              <div key={idx} className="bg-slate-850 border border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
                    <span className="px-2.5 py-1 bg-amber-400 text-slate-950 font-black text-xs rounded-lg shadow-sm">
                      {stance.durationRange}
                    </span>
                    <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                      {stance.stanceTheme}
                    </span>
                  </div>

                  {/* 3 Copyable Text Hook Stance Options */}
                  <div className="space-y-2 my-2">
                    <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/70 text-xs flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-amber-300 uppercase block">{language === 'ko' ? '문구 1' : 'Copy option 1'}</span>
                        <span className="text-slate-100 font-medium">"{stance.optionAHookText}"</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(stance.optionAHookText, `stance-a-${idx}`)}
                        className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg shrink-0 transition-colors"
                        title="Copy Option A Hook"
                      >
                        {copiedText === `stance-a-${idx}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/70 text-xs flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-300 uppercase block">{language === 'ko' ? '문구 2' : 'Copy option 2'}</span>
                        <span className="text-slate-100 font-medium">"{stance.optionBHookText}"</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(stance.optionBHookText, `stance-b-${idx}`)}
                        className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg shrink-0 transition-colors"
                        title="Copy Option B Hook"
                      >
                        {copiedText === `stance-b-${idx}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/70 text-xs flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-blue-300 uppercase block">{language === 'ko' ? '문구 3' : 'Copy option 3'}</span>
                        <span className="text-slate-100 font-medium">"{stance.optionCHookText}"</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(stance.optionCHookText, `stance-c-${idx}`)}
                        className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg shrink-0 transition-colors"
                        title="Copy Option C Hook"
                      >
                        {copiedText === `stance-c-${idx}` ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-950/60 p-2.5 rounded-xl border border-indigo-900/60 text-[11px] text-indigo-200 mt-2">
                  <strong className="text-amber-300 block mb-0.5 font-bold">{language === 'ko' ? '화면에 자연스럽게 쓰는 법' : 'How to make it feel natural on screen'}</strong>
                  {stance.onScreenGuidance}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {evaluation.editPlan && <EditPlan plan={evaluation.editPlan} editTypes={Object.fromEntries(evaluation.actionableEdits.map(edit => [edit.id, edit.type]))} language={language} inventory={evaluation.grounding?.inventory} />}
      {/* Legacy reports retain their original layout. */}
      {!evaluation.editPlan && <>
      {/* 4. Actionable Edit Suggestions */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Scissors className="w-5 h-5 text-indigo-600" /> {t('actionableEditsTitle')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('actionableEditsSub')}
            </p>
          </div>
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-bold">
            {evaluation.actionableEdits.length}{t('suggestedEdits')}
          </span>
        </div>

        <div className="space-y-3">
          {evaluation.actionableEdits.map((edit, idx) => (
            <div
              key={edit.id || idx}
              className="bg-slate-50 border border-gray-100 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-gray-200 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="px-2.5 py-1 bg-white text-indigo-600 border border-gray-200 rounded-lg text-xs font-mono font-bold shrink-0">
                  {edit.timestampRange}
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase ${
                        edit.severity === 'critical'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : edit.severity === 'recommended'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {getSeverityLabel(edit.severity)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">{edit.issue}</p>
                  <p className="text-xs text-green-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    {t('solutionLabel')} {edit.solution}
                  </p>
                </div>
              </div>

              <button
                onClick={() => copyToClipboard(edit.solution, edit.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-slate-700 rounded-lg text-xs font-bold shrink-0 transition-colors shadow-sm"
              >
                {copiedText === edit.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" /> {t('copied')}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" /> {t('copyFix')}
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      </>}

      {!evaluation.editPlan && <>
      {/* 5. Caption & Growth Package Optimizer */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-indigo-600" /> {t('captionOptimizerTitle')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('captionOptimizerSub')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top 3 Alternative Hooks */}
          <div className="bg-slate-50 border border-gray-100 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-indigo-600" /> {t('recommendedHooks')}
            </h4>
            <div className="space-y-2">
              {evaluation.captionOptimization.recommendedHooks.map((hook, i) => (
                <div key={i} className="flex items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-gray-200 text-xs text-slate-800">
                  <span className="font-medium">"{hook}"</span>
                  <button
                    onClick={() => copyToClipboard(hook, `hook-${i}`)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors"
                  >
                    {copiedText === `hook-${i}` ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* High-Converting CTAs */}
          <div className="bg-slate-50 border border-gray-100 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-green-600" /> {language === 'ko' ? '행동 유도 문구(CTA)' : 'Active Call-to-Actions (CTAs)'}
            </h4>

            {/* Value CTA */}
            <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-xs space-y-1">
              <div className="text-[10px] font-bold text-green-700 uppercase">{t('valueCTA')}</div>
              <p className="text-slate-800 font-medium">{evaluation.captionOptimization.valueCTA}</p>
            </div>

            {/* Cliffhanger CTA */}
            <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-xs space-y-1">
              <div className="text-[10px] font-bold text-indigo-600 uppercase">{t('cliffhangerCTA')}</div>
              <p className="text-slate-800 font-medium">{evaluation.captionOptimization.cliffhangerCTA}</p>
            </div>

            {/* Comment Bait */}
            <div className="p-2.5 bg-white rounded-xl border border-gray-200 text-xs space-y-1">
              <div className="text-[10px] font-bold text-blue-600 uppercase">{t('commentBait')}</div>
              <p className="text-slate-800 font-medium">{evaluation.captionOptimization.commentBaitQuestion}</p>
            </div>
          </div>
        </div>

        {/* Target Hashtags */}
        <div className="bg-slate-50 border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
              <Hash className="w-3.5 h-3.5 text-indigo-600" /> {t('recommendedHashtags')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {evaluation.captionOptimization.targetHashtags.map((tag, idx) => (
                <span key={idx} className="px-2.5 py-1 bg-white text-indigo-700 border border-gray-200 rounded-lg text-xs font-semibold">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() =>
              copyToClipboard(
                `${evaluation.captionOptimization.valueCTA}\n\n${evaluation.captionOptimization.commentBaitQuestion}\n\n${evaluation.captionOptimization.targetHashtags.join(' ')}`,
                'full-caption'
              )
            }
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-md shadow-indigo-100"
          >
            {copiedText === 'full-caption' ? (
              <>
                <Check className="w-4 h-4 text-white" /> {t('copiedFullPackage')}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> {t('copyCompletePackage')}
              </>
            )}
          </button>
        </div>
      </div>

      </>}

      {/* AI Accuracy & Creator Advisory Notice */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 text-amber-900 shadow-sm">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
            {t('aiDisclaimerTitle')}
          </h4>
          <p className="text-xs text-amber-800 leading-relaxed font-normal">
            {t('aiDisclaimer')}
          </p>
        </div>
      </div>

      {/* AI Custom Hook & Caption Generator Modal */}
      {showCaptionsGenerator && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-6 space-y-4 shadow-2xl relative text-slate-800 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <button
              onClick={() => setShowCaptionsGenerator(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 text-sm font-bold bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center"
            >
              ✕
            </button>

            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">{t('modalTitle')}</h3>
            </div>
            <p className="text-xs text-slate-500">
              {t('modalSub')}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('topicLabel')}</label>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder={t('topicPlaceholder')}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={handleGenerateCaptions}
                disabled={isGeneratingCaptions || !customTopic}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
              >
                {isGeneratingCaptions ? <Sparkles className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{isGeneratingCaptions ? t('btnGeneratingHooks') : t('btnGenerateHooks')}</span>
              </button>
            </div>

            {generatedCaptions && (
              <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4 space-y-3 max-h-80 overflow-y-auto">
                <div>
                  <h4 className="text-xs font-bold text-amber-700 uppercase">{t('generatedHooksLabel')}</h4>
                  <ul className="text-xs text-slate-800 space-y-1 mt-1">
                    {generatedCaptions.hooks?.map((h: string, idx: number) => (
                      <li key={idx} className="p-2 bg-white rounded border border-gray-200">
                        "{h}"
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="text-xs text-slate-800">
                  <strong className="text-green-700 block mb-0.5">{t('valueCTA')}:</strong>
                  {generatedCaptions.valueCTA}
                </div>

                <div className="text-xs text-slate-800">
                  <strong className="text-indigo-600 block mb-0.5">{t('commentBait')}:</strong>
                  {generatedCaptions.commentBaitQuestion}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
