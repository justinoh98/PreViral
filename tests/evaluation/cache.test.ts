import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceKey, EvaluationCache } from '../../evaluation/cache';
import { request } from '../fixtures/evaluatorCases';
test('full evidence and model versions determine cache identity', () => {
  const r = request(); const key = evidenceKey(r.evidence, 'model');
  r.title = 'renamed'; r.language = 'ko'; assert.equal(evidenceKey(r.evidence, 'model'), key);
  assert.notEqual(evidenceKey(r.evidence, 'different-model'), key);
  r.evidence.frames[0].imageUrl = 'data:image/jpeg;base64,Yg=='; assert.notEqual(evidenceKey(r.evidence, 'model'), key);
});
test('cache is bounded and returns isolated values', () => {
  const c = new EvaluationCache<{ stars: number }>(1); c.set('a', { stars: 2 }); const copy = c.get('a')!; copy.stars = 5; assert.equal(c.get('a')!.stars, 2);
  c.set('b', { stars: 3 }); assert.equal(c.get('a'), undefined);
});
test('a revised source file cannot reuse a cached review even if its sampled images happen to match', () => {
  const r = request(); r.evidence.sourceFingerprint = '10-12345678-12345678'; const before = evidenceKey(r.evidence, 'model');
  r.evidence.sourceFingerprint = '10-12345678-12345679'; assert.notEqual(evidenceKey(r.evidence, 'model'), before);
});
