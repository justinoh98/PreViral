import test from 'node:test';
import assert from 'node:assert/strict';
import { validateObservations, validateEvidence } from '../../evaluation/validation';
import { sampleTimes } from '../../src/evaluation/mediaEvidence';
import { observations, request } from '../fixtures/evaluatorCases';

test('valid grounded observations pass', () => { const r = request(); assert.ok(validateObservations(observations(), r.evidence, false)); });
test('unknown scene/frame references are rejected', () => { const o = observations(); o.scenes[0].frameIds = ['invented']; assert.throws(() => validateObservations(o, request().evidence, false)); });
test('numeric LLM rating fields are rejected', () => { assert.throws(() => validateObservations({ ...observations(), overallStars: 5 }, request().evidence, false)); });
test('opening cannot use later evidence', () => { const o = observations(); o.traits.firstFrame.frameIds = ['frame-35']; assert.throws(() => validateObservations(o, request().evidence, false)); });
test('missing audio blocks speech-dependent review', () => { const o = observations(); o.audioEssential = true; assert.throws(() => validateObservations(o, request().evidence, false)); });
test('analyzer insufficiency is explicit', () => { const o = observations(); o.coverage = 'insufficient'; assert.throws(() => validateObservations(o, request().evidence, false)); });
test('exceptional requires multiple corroborating frames', () => { const o = observations('exceptional'); o.traits.payoff.frameIds = ['frame-35']; assert.throws(() => validateObservations(o, request().evidence, false)); });
test('unordered frames and missing ending are rejected', () => {
  const r = request(); r.evidence.frames.reverse(); assert.throws(() => validateEvidence(r.evidence));
  const r2 = request(); r2.evidence.frames.pop(); assert.throws(() => validateEvidence(r2.evidence));
});
test('sampler covers first frame, opening, middle and ending within bounded work', () => {
  for (const duration of [.5, 3, 15, 30, 90, 300]) {
    const times = sampleTimes(duration); assert.equal(times[0], 0); assert.ok(times.at(-1)! >= duration * .95); assert.ok(times.length <= 96);
    const r = request(); r.evidence.durationSeconds = duration; r.evidence.frames = times.map((timeSec, i) => ({ id: `f${i}`, timeSec, imageUrl: 'data:image/jpeg;base64,YQ==' })); validateEvidence(r.evidence);
  }
});
