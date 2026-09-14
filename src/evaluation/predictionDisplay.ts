import type { GrowthPrediction } from '../../evaluation/contracts';

export function formatGrowthPrediction(prediction: GrowthPrediction | undefined, fallback: number | null, language: 'en' | 'ko') {
  if (!prediction) return {
    range: fallback === null ? '—' : `${fallback}/100`,
    detail: language === 'ko' ? '이전 잠재력 지수' : 'Legacy potential index',
    explanation: '',
  };
  const confidence = language === 'ko'
    ? prediction.confidence === 'high' ? '높은 신뢰도' : '중간 신뢰도'
    : prediction.confidence === 'high' ? 'High-confidence' : 'Medium-confidence';
  return {
    range: `${prediction.low}–${prediction.high}%`,
    detail: language === 'ko' ? `${confidence} 참고용 추정 · 성과 보장 아님` : `${confidence} heuristic · not guaranteed`,
    explanation: prediction.explanation,
  };
}
