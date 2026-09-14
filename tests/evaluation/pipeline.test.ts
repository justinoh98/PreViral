import test from 'node:test';
import assert from 'node:assert/strict';
import { responseText } from '../../evaluation/provider';
import { evaluate } from '../../evaluation/analyze';
import { observations, feedback, request } from '../fixtures/evaluatorCases';
import { inventory, verification, interpretation } from '../fixtures/groundingCases';
test('raw Responses message array is parsed including preceding reasoning', () => {
  assert.equal(responseText({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] }), '{"ok":true}');
});
test('refusal, incomplete, empty and error responses never become ratings', () => {
  for (const payload of [{ output: [] }, { status: 'incomplete' }, { error: {} }, { output: [{ type: 'message', content: [{ type: 'refusal' }] }] }]) assert.throws(() => responseText(payload));
});
test('missing key returns unavailable rather than a fallback score', async () => { await assert.rejects(evaluate(request(), undefined, 'model'), /not connected/); });
test('valid observation pipeline creates canonical scores and a versioned adapter result', async () => {
  const r = request(); const result = await evaluate(r, 'test-key', 'fixture-model', { call: async (_k, _m, _p, _c, _s, name) => name === 'previral_inventory' ? inventory() : name === 'previral_inventory_check' ? verification() : interpretation(), transcribe: async () => '', explain: async () => feedback() });
  assert.equal(result.overallStars, 4); assert.equal(result.overallScorePercent, 80); assert.ok(result.editPlan); assert.equal(result.aspects.narrativeAndPayoff.payoffTimingSec, null);
  assert.equal(result.aspects.technicalCompliance.label, 'Technical & Unconnected Reach');
});
test('provider failure never produces a measured or fabricated score', async () => {
  await assert.rejects(evaluate(request(), 'test-key', 'failing-model', { call: async () => { throw new Error('offline'); }, transcribe: async () => '', explain: async () => feedback() }), /offline/);
});
test('a grounded evaluation keeps required heuristic skip and follower/reach predictions when optional indices are unknown', async () => {
  const interpreted = interpretation();
  interpreted.observations.traits.conversion.level = 'unknown';
  interpreted.observations.traits.nonFollowerAppeal.level = 'unknown';
  interpreted.observations.traits.shareability.level = 'unknown';
  const result = await evaluate(request(), 'test-key', 'prediction-envelope-model', {
    call: async (_key, _model, _prompt, _content, _schema, name) => name === 'previral_inventory' ? inventory() : name === 'previral_inventory_check' ? verification() : interpreted,
    transcribe: async () => '', explain: async () => feedback(),
  });
  assert.equal(result.conversionIndex, null);
  assert.equal(result.shareabilitySendScore, null);
  assert.ok(Number.isFinite(result.followerGrowthPotentialPercent));
  assert.ok(result.growthPrediction.low <= result.followerGrowthPotentialPercent);
  assert.ok(result.growthPrediction.high >= result.followerGrowthPotentialPercent);
  assert.equal(result.growthPrediction.confidence, 'medium');
  assert.equal(result.growthPrediction.basis, 'heuristic_not_empirically_calibrated');
  assert.equal(result.prediction?.basis, 'heuristic_not_empirically_calibrated');
});
