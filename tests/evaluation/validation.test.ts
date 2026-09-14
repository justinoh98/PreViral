import test from 'node:test';
import assert from 'node:assert/strict';
import { validateObservations, validateEvidence } from '../../evaluation/validation';
import { measurementTimes, sampleTimes } from '../../src/evaluation/mediaEvidence';
import { observations, request } from '../fixtures/evaluatorCases';
import { analyzeVisualFrames, unavailableAudioAnalysis, type PixelFrame } from '../../evaluation/mediaAnalysis';

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
test('versioned local evidence must match the uploaded content and cover the actual beginning and ending', () => {
  const r = request();
  const fingerprint = 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const measurements: PixelFrame[] = measurementTimes(r.evidence.durationSeconds).map((timeSec, index) => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([index, 20, 40, 255], offset);
    return { id: `measurement-${index}`, timeSec, width: 4, height: 4, pixels };
  });
  const analysis = analyzeVisualFrames(measurements, r.evidence.durationSeconds, fingerprint);
  analysis.audio = unavailableAudioAnalysis('Fixture has no decoded audio.');
  analysis.firstFrame.id = r.evidence.frames[0].id;
  analysis.endingFrame.id = r.evidence.frames.at(-1)!.id;
  analysis.startEndSimilarity.evidenceIds = [analysis.firstFrame.id, analysis.endingFrame.id];
  for (const shot of analysis.shots) shot.representativeFrameId = r.evidence.frames.reduce((closest, frame) => {
    const time = analysis.measurements.find(row => row.id === shot.representativeMeasurementId)!.timeSec;
    return Math.abs(frame.timeSec - time) < Math.abs(closest.timeSec - time) ? frame : closest;
  }, r.evidence.frames[0]).id;
  r.evidence.sourceFingerprint = fingerprint;
  r.evidence.analysis = analysis;
  assert.doesNotThrow(() => validateEvidence(r.evidence));
  r.evidence.analysis.sourceFingerprint = fingerprint.replace(/^sha256-a/, 'sha256-b');
  assert.throws(() => validateEvidence(r.evidence), /local evidence/i);
  r.evidence.analysis.sourceFingerprint = fingerprint;
  r.evidence.analysis.measurements[10].timeSec += .4;
  assert.throws(() => validateEvidence(r.evidence), /local evidence/i);
});
