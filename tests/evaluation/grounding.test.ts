import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInventory, groundingReport } from '../../evaluation/grounding';
import { validateInterpretation } from '../../evaluation/interpret';
import { evaluate } from '../../evaluation/analyze';
import { inventory, verification, interpretation, continuousShot } from '../fixtures/groundingCases';
import { request, feedback } from '../fixtures/evaluatorCases';

test('specific inventory with actual opening/ending references can pass visual verification', () => {
  const i = validateInventory(inventory(), request().evidence, '');
  assert.equal(groundingReport(i, verification(i), 'Toys & Hobbies', 1).status, 'HIGH');
});
test('one continuous slow shot can be fully grounded without invented scenes or payoff', () => {
  const i = validateInventory(continuousShot(), request().evidence, '');
  assert.equal(groundingReport(i, verification(i), 'Travel & Aesthetic Vlogs', 1).status, 'HIGH');
});
test('generic or hallucinated inventory cannot pass just by citing valid IDs', () => {
  const i = inventory(); const v = verification();
  v.specificToVideo = false; assert.equal(groundingReport(i, v, 'Photography', 1).status, 'LOW');
  v.specificToVideo = true; v.unsupportedClaims = ['The claimed chef is not visible in the images.'];
  assert.equal(groundingReport(i, v, 'Photography', 1).status, 'LOW');
});
test('ending must refer to actual ending evidence, not a section label', () => {
  const i = inventory(); i.scenes[2].frameIds = ['frame-1'];
  assert.throws(() => validateInventory(i, request().evidence, ''), /ending/);
});
test('duplicate evidence and unsupported speech/audio claims fail', () => {
  const i = inventory(); i.scenes[0].frameIds = ['frame-1', 'frame-1']; assert.throws(() => validateInventory(i, request().evidence, ''));
  const speech = inventory(); speech.elements.speech.state = 'observed'; assert.throws(() => validateInventory(speech, request().evidence, ''), /Speech/);
  const music = inventory(); music.elements.audioBehavior.state = 'observed'; music.elements.audioBehavior.sceneIds = ['opening']; assert.throws(() => validateInventory(music, request().evidence, ''), /Music/);
});
test('unavailable speech cannot be treated as confirmed absent', () => {
  const i = inventory(); i.elements.speech.state = 'not_observed'; assert.throws(() => validateInventory(i, request().evidence, ''), /unclear/);
});
test('interpretation cannot replace facts or selected niche', () => {
  const i = inventory(); const g = groundingReport(i, verification(), 'Photography', 1); const p = interpretation('Photography');
  p.observations.scenes[0].description = 'A chef flips pancakes.';
  assert.throws(() => validateInterpretation(p, i, request().evidence, 'Photography', false, g), /inventory/);
  assert.throws(() => validateInterpretation(interpretation(), i, request().evidence, 'Photography', false, g), /Niche/);
});
test('failed grounding retries once with diagnostic issues and never scores or explains', async () => {
  let inventoryCalls = 0; let explains = 0;
  await assert.rejects(evaluate(request(), 'test', 'grounding-fail-test', {
    call: async (_k, _m, _p, content, _s, name) => {
      if (name === 'previral_inventory') { inventoryCalls++; if (inventoryCalls === 2) assert.match(JSON.stringify(content), /does not yet identify/); return inventory(); }
      if (name === 'previral_inventory_check') return { ...verification(), specificToVideo: false };
      throw new Error('Judgment must not run before grounding.');
    }, transcribe: async () => '', explain: async () => { explains++; return feedback(); },
  }), (e: any) => e.code === 'INSUFFICIENT_GROUNDING' && e.grounding.status === 'LOW' && e.grounding.attempts === 2 && !('overallStars' in e));
  assert.equal(inventoryCalls, 2); assert.equal(explains, 0);
});
test('targeted second pass can recover without changing scoring rules', async () => {
  let checks = 0;
  const result = await evaluate(request(), 'test', 'grounding-recovery-test', {
    call: async (_k, _m, _p, _c, _s, name) => name === 'previral_inventory' ? inventory() : name === 'previral_inventory_check' ? { ...verification(), specificToVideo: ++checks > 1 } : interpretation(),
    transcribe: async () => '', explain: async () => feedback(),
  });
  assert.equal(result.grounding?.attempts, 2); assert.equal(result.grounding?.status, 'HIGH'); assert.equal(result.overallStars, 4);
});
