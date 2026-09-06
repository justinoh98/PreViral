import React, { useEffect, useState } from 'react';
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
  Lightbulb,
  Info,
  AlertCircle,
} from 'lucide-react';
import { ReelEvaluation } from '../types';
import { StarRating } from './StarRating';
import { useLanguage } from '../i18n';
import { createLocalCaptions } from '../localFallback';

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
  const [customTopic, setCustomTopic] = useState<string>(evaluation.videoConcept || evaluation.captionInput || evaluation.niche || '');
  const [generatedCaptions, setGeneratedCaptions] = useState<any>(null);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState<boolean>(false);

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

  const getTypeLabel = (type: string) => {
    if (language !== 'ko') return type;
    switch (type) {
      case 'hook':
        return '훅 연출';
      case 'pacing':
        return '편집 속도';
      case 'payoff':
        return '스토리 결말';
      case 'safezone':
        return '자막 안전지대';
      case 'audio':
        return '오디오';
      case 'cut':
        return '컷 편집';
      default:
        return '일반 항목';
    }
  };

  // Strict observation mode also suppresses unsupported content in old reports.
  return (
    <div className="space-y-6">
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <h2 className="text-2xl font-bold">{language === 'ko' ? '시각적 관찰' : 'Visual observations'}</h2>
        <p className="text-base text-slate-600">{language === 'ko' ? '샘플 화면의 픽셀 변화와 밝기만 확인합니다. 피사체, 자막, 이야기, 오디오는 인식하지 않습니다. 훅·CTA·문구 수정 제안은 제공하지 않습니다.' : 'Checks sampled pixel changes and brightness only. It does not recognize subjects, read text, understand stories, or inspect audio. Hook, CTA, and text-replacement suggestions are withheld.'}</p>
        <div className="flex items-center gap-4 flex-wrap">
          <StarRating rating={evaluation.overallStars} />
          <span>{evaluation.overallScorePercent}%</span>
          <span>{evaluation.durationSeconds}s</span>
        </div>
        <p className="text-sm text-slate-500">{language === 'ko' ? '점수는 제한적인 휴리스틱이며 콘텐츠 품질이나 성공 확률이 아닙니다.' : 'The score is a limited heuristic, not a content-quality judgment or probability of success.'}</p>
        <button onClick={onReEvaluate} className="rounded-xl bg-indigo-600 text-white px-4 py-3">{t('reEvaluateTest')}</button>
      </section>
      {(evaluation.visualObservations ?? []).map((item, index) => (
        <section key={index} className="bg-slate-50 border border-gray-200 rounded-2xl p-6 space-y-3">
          <span className="text-indigo-700 font-mono">{item.location}</span>
          <p className="text-base text-slate-800">{item.observation}</p>
          <p className="text-base text-green-800">{item.suggestion}</p>
        </section>
      ))}
      {!evaluation.visualObservations?.length && <p className="text-base p-6">{language === 'ko' ? '이 보고서에 검증된 시각적 관찰이 없습니다. 일반적인 조언으로 대체하지 않습니다.' : 'No verified visual observations are available for this report. Generic advice is not substituted.'}</p>}
    </div>
  );
};
