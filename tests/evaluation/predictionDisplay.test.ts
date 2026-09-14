import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGrowthPrediction } from '../../src/evaluation/predictionDisplay';

const prediction = { low: 40, high: 90, midpoint: 65, confidence: 'medium' as const, basis: 'heuristic_not_empirically_calibrated' as const, explanation: 'Broad evidence-backed range.' };

test('growth prediction display exposes range, confidence, and heuristic uncertainty', () => {
  assert.deepEqual(formatGrowthPrediction(prediction, 65, 'en'), {
    range: '40–90%',
    detail: 'Medium-confidence heuristic · not guaranteed',
    explanation: 'Broad evidence-backed range.',
  });
  assert.equal(formatGrowthPrediction(prediction, 65, 'ko').detail, '중간 신뢰도 참고용 추정 · 성과 보장 아님');
});

test('legacy evaluations retain a clearly labelled fallback display', () => {
  assert.deepEqual(formatGrowthPrediction(undefined, 70, 'en'), { range: '70/100', detail: 'Legacy potential index', explanation: '' });
});
