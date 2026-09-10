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
});
test('provider failure never produces a measured or fabricated score', async () => {
  await assert.rejects(evaluate(request(), 'test-key', 'failing-model', { call: async () => { throw new Error('offline'); }, transcribe: async () => '', explain: async () => feedback() }), /offline/);
});
