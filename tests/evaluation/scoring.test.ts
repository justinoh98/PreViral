import test from 'node:test';
import assert from 'node:assert/strict';
import { ASPECTS, TRAITS } from '../../evaluation/contracts';
import { scoreObservations, WEIGHTS, calculateOverall } from '../../evaluation/scoring';
import { observations, calibrationCases } from '../fixtures/evaluatorCases';

for (const fixture of calibrationCases) test(fixture.name, () => {
  const o = observations(fixture.level);
  if (fixture.level === 'weak') { o.traits.imageQuality.level = 'competent'; o.traits.payoff.level = 'below_average'; }
  if (fixture.level === 'competent') { o.traits.curiosity.level = 'below_average'; o.traits.imageQuality.level = 'strong'; }
  const score = scoreObservations(o);
  assert.ok(score.overallStars >= fixture.low && score.overallStars <= fixture.high, JSON.stringify(score));
});
test('reference weights and one canonical overall', () => {
  assert.deepEqual(Object.values(WEIGHTS), [.3, .25, .2, .15, .1]);
  const s = scoreObservations(observations('strong'));
  assert.equal(s.overallStars, calculateOverall(s.aspectScores));
  assert.equal(s.overallScorePercent, Math.round(s.overallStars * 20));
});
test('severe opening failure cannot be compensated by a perfect remainder', () => {
  const o = observations('outstanding');
  o.weaknesses.push({ id: 'delayed-hook', aspect: 'hookStrength', severity: 'severe', problem: 'The opening shows blank setup without a visual promise.', sceneIds: ['opening'] });
  const s = scoreObservations(o);
  assert.ok(s.aspectScores.hookStrength <= 1.5); assert.ok(s.overallStars <= 4); assert.ok(s.skipEstimate.midpoint >= 65);
});
test('beautiful visuals do not erase repetitive progression', () => {
  const o = observations('exceptional');
  o.traits.progression.level = 'weak'; o.traits.pacing.level = 'weak';
  o.weaknesses.push({ id: 'repeat', aspect: 'pacingAndStimulation', severity: 'major', problem: 'The middle repeats the same setup without developing it.', sceneIds: ['middle'] });
  const s = scoreObservations(o); assert.ok(s.aspectScores.pacingAndStimulation <= 2.5); assert.equal(s.aspectScores.technicalCompliance, 4.8); assert.ok(s.overallStars < 4.5);
});
test('excellent hook with weak remainder stays a weak overall', () => {
  const o = observations('weak');
  for (const key of ['firstFrame', 'openingClarity', 'curiosity', 'anticipation'] as const) o.traits[key].level = 'exceptional';
  const s = scoreObservations(o); assert.equal(s.aspectScores.hookStrength, 4.8); assert.ok(s.overallStars <= 2.5);
});
test('slow cinematic opening with immediate visual intrigue stays strong', () => {
  const o = observations('strong');
  o.traits.firstFrame.reason = 'The motionless miniature street has an uncanny scale and rich reflections that create immediate intrigue.';
  o.traits.pacing.reason = 'The held compositions reveal lighting changes with enough beauty and anticipation to sustain interest.';
  assert.equal(scoreObservations(o).aspectScores.hookStrength, 4);
});
test('fast cutting does not rescue meaningless progression', () => {
  const o = observations('strong'); o.traits.progression.level = 'ineffective'; o.traits.pacing.level = 'weak';
  o.traits.pacing.reason = 'Rapid alternating views repeat the same information without developing the scene.';
  assert.ok(scoreObservations(o).aspectScores.pacingAndStimulation < 3);
});
test('multiple major retention failures exclude excellent range', () => {
  const o = observations('outstanding');
  o.weaknesses = ['narrativeAndPayoff', 'loopingAndRetention'].map((aspect, i) => ({ id: `w${i}`, aspect: aspect as typeof ASPECTS[number], severity: 'major', problem: 'The observed section fails to deliver the intended viewer value.', sceneIds: ['ending'] }));
  assert.ok(scoreObservations(o).overallStars <= 4.1);
});
test('unknown is not zero or a friendly default', () => {
  const o = observations(); o.traits.payoff.level = 'unknown'; assert.throws(() => scoreObservations(o), /could not be assessed/);
});
test('optional absent text is not a penalty', () => {
  const o = observations('strong'); o.traits.textLegibility.level = 'not_applicable'; assert.equal(scoreObservations(o).aspectScores.technicalCompliance, 4);
});
test('unknown conversion and sharing do not lower supported creative ratings', () => {
  const o = observations('strong'); o.traits.conversion.level = 'unknown'; o.traits.shareability.level = 'unknown'; o.traits.nonFollowerAppeal.level = 'unknown';
  const s = scoreObservations(o); assert.equal(s.overallStars, 4); assert.equal(s.conversionIndex, null); assert.equal(s.shareabilityIndex, null); assert.equal(s.nonFollowerInterestStars, null);
});
test('low confidence prevents unsupported complete ratings', () => {
  const o = observations(); o.traits.pacing.confidence = 'low'; assert.throws(() => scoreObservations(o));
});
test('identical observations always give identical numerical results', () => {
  const o = observations('excellent'); const expected = scoreObservations(o);
  for (let i = 0; i < 50; i++) assert.deepEqual(scoreObservations(structuredClone(o)), expected);
});
test('weaker opening monotonically increases estimated skip risk', () => {
  const o = observations('strong'); const before = scoreObservations(o);
  o.traits.firstFrame.level = 'weak'; o.traits.curiosity.level = 'weak';
  assert.ok(scoreObservations(o).skipEstimate.midpoint > before.skipEstimate.midpoint);
});
test('scores and estimates stay within documented bounds', () => {
  for (const fixture of calibrationCases) {
    const s = scoreObservations(observations(fixture.level));
    for (const a of ASPECTS) assert.ok(s.aspectScores[a] >= 0 && s.aspectScores[a] <= 5);
    assert.ok(s.skipEstimate.low <= s.skipEstimate.high);
    assert.equal(s.skipEstimate.midpoint % 5, 0);
  }
});
test('metadata never enters the scoring input and changing wording cannot change scores', () => {
  const o = observations('strong'); const original = scoreObservations(o);
  for (const key of TRAITS) o.traits[key].reason = '다른 언어로 표현된 동일한 관찰입니다.';
  o.concept = 'Different supplied description'; assert.deepEqual(scoreObservations(o), original);
});
