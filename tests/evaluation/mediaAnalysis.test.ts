import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAudioSamples, analyzeVisualFrames, selectRepresentativeTimes, type PixelFrame } from '../../evaluation/mediaAnalysis';
import { ANALYZER_VERSION } from '../../evaluation/contracts';

const solid = (id: string, timeSec: number, rgb: [number, number, number]): PixelFrame => {
  const pixels = new Uint8ClampedArray(16 * 16 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = rgb[0]; pixels[i + 1] = rgb[1]; pixels[i + 2] = rgb[2]; pixels[i + 3] = 255;
  }
  return { id, timeSec, width: 16, height: 16, pixels };
};

const split = (id: string, timeSec: number, left: [number, number, number], right: [number, number, number]): PixelFrame => {
  const frame = solid(id, timeSec, left);
  for (let y = 0; y < frame.height; y++) for (let x = 8; x < frame.width; x++) {
    const i = (y * frame.width + x) * 4;
    frame.pixels[i] = right[0]; frame.pixels[i + 1] = right[1]; frame.pixels[i + 2] = right[2];
  }
  return frame;
};

const gradient = (id: string, timeSec: number, offset: number): PixelFrame => {
  const frame = solid(id, timeSec, [0, 0, 0]);
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
    const value = (x * 11 + y * 7 + offset) % 256;
    const i = (y * frame.width + x) * 4;
    frame.pixels[i] = value; frame.pixels[i + 1] = 255 - value; frame.pixels[i + 2] = (value * 3) % 256;
  }
  return frame;
};

test('whole-Reel measurements produce stable evidence, shots, opening, ending, repetition, and technical signals', () => {
  const frames = [
    solid('m1', 0, [180, 20, 20]), solid('m2', 1, [182, 20, 20]),
    split('m3', 2, [10, 10, 220], [240, 240, 20]), split('m4', 3, [12, 12, 222], [238, 238, 18]),
    solid('m5', 4, [180, 20, 20]), solid('m6', 5.999, [181, 20, 20]),
  ];
  const result = analyzeVisualFrames(frames, 6, 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

  assert.equal(result.version, ANALYZER_VERSION);
  assert.equal(result.firstFrame.measurementId, result.measurements[0].id);
  assert.equal(result.endingFrame.measurementId, result.measurements.at(-1)?.id);
  assert.equal(result.measurements[0].timeSec, 0);
  assert.equal(result.measurements.at(-1)?.timeSec, 5.999);
  assert.equal(result.shots[0].startSec, 0);
  assert.equal(result.shots.at(-1)?.endSec, 6);
  assert.ok(result.shots.every(shot => shot.durationSec > 0 && shot.representativeMeasurementId));
  assert.ok(result.shots.some(shot => shot.boundary.kind === 'candidate_hard_cut'));
  assert.ok(result.repeatedShotCandidates.length > 0);
  assert.ok(result.startEndSimilarity.value !== null && result.startEndSimilarity.value > .9);
  assert.ok(result.opening.measurementIds.length > 0);
  assert.ok(result.endingTail.measurementIds.includes(result.measurements.at(-1)!.id));
  assert.equal(result.text.state, 'unavailable');
  assert.equal(result.provenance, 'measured_local');
  assert.ok(result.technical.frameCount === frames.length);
});

test('same niche cannot collapse substantially different videos into the same evidence', () => {
  const cutVideo = [solid('a1', 0, [220, 20, 20]), solid('a2', .75, [220, 20, 20]), solid('a3', 1.5, [20, 20, 220]), solid('a4', 2.25, [20, 20, 220]), solid('a5', 3, [220, 20, 20]), solid('a6', 3.999, [220, 20, 20])];
  const evolvingVideo = [gradient('b1', 0, 0), gradient('b2', .75, 4), gradient('b3', 1.5, 8), gradient('b4', 2.25, 12), gradient('b5', 3, 16), gradient('b6', 3.999, 20)];
  const first = analyzeVisualFrames(cutVideo, 4, 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const second = analyzeVisualFrames(evolvingVideo, 4, 'sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

  assert.notDeepEqual(first.shots.map(shot => [shot.startSec, shot.endSec]), second.shots.map(shot => [shot.startSec, shot.endSec]));
  assert.notDeepEqual(first.measurements.map(row => row.id), second.measurements.map(row => row.id));
  assert.notDeepEqual(first.measurements.map(row => row.visualChangeFromPrevious), second.measurements.map(row => row.visualChangeFromPrevious));
  assert.notDeepEqual(first.repeatedShotCandidates, second.repeatedShotCandidates);
  assert.notDeepEqual(first.opening, second.opening);
  assert.notDeepEqual(first.endingTail, second.endingTail);
  assert.notDeepEqual(first.technical, second.technical);
});

test('continuous still or slowly evolving footage remains evidence-only without automatic creative penalties', () => {
  const still = [0, 1, 2, 3, 4.999].map((time, index) => solid(`s${index}`, time, [30 + index, 40 + index, 50 + index]));
  const result = analyzeVisualFrames(still, 5, 'sha256-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc');
  const serialized = JSON.stringify(result);

  assert.equal(result.shots.length, 1);
  assert.equal(result.opening.activityLevel, 'low');
  assert.equal(result.text.state, 'unavailable');
  assert.doesNotMatch(serialized, /penalty|boring|dead air|bad pacing|score/i);
  assert.match(result.limitations.join(' '), /semantic/i);
});

test('representative selection preserves first, dense opening, boundaries, full duration, and actual ending', () => {
  const frames = Array.from({ length: 121 }, (_, index) => gradient(`m${index}`, index / 10, index));
  frames[frames.length - 1].timeSec = 11.999;
  const analysis = analyzeVisualFrames(frames, 12, 'sha256-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd');
  const selected = selectRepresentativeTimes(analysis, 12, 20);
  assert.equal(selected[0], 0);
  assert.equal(selected.at(-1), 11.999);
  assert.ok(selected.filter(time => time <= 3).length >= 8);
  assert.ok(selected.length <= 20);
  for (const shot of analysis.shots.slice(1)) assert.ok(selected.some(time => Math.abs(time - shot.startSec) <= .101));
});

test('audio analysis reports onset, activity, silence, changes, and ending candidates without semantic conclusions', () => {
  const sampleRate = 1000;
  const samples = new Float32Array(3000);
  for (let i = 500; i < 1500; i++) samples[i] = i % 2 ? .4 : -.4;
  for (let i = 2200; i < samples.length; i++) samples[i] = i % 2 ? .1 : -.1;
  const result = analyzeAudioSamples(samples, sampleRate, 'sha256-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');

  assert.equal(result.trackState, 'available');
  assert.equal(result.onsetDelaySec.value, .5);
  assert.deepEqual(result.silenceIntervals.map(region => [region.startSec, region.endSec]), [[0, .5], [1.5, 2.2]]);
  assert.ok(result.changePoints.some(point => point.timeSec === .5));
  assert.equal(result.trailingSilenceCandidate.value, false);
  assert.equal(result.activeAtCutoffCandidate.value, true);
  assert.doesNotMatch(JSON.stringify(result), /dead air|boring|penalty/i);
});

test('absent and unavailable audio remain explicit and do not become a silence penalty', () => {
  const absent = analyzeAudioSamples(new Float32Array(1000), 1000, 'sha256-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  assert.equal(absent.trackState, 'absent');
  assert.equal(absent.onsetDelaySec.state, 'not_observed');
  assert.equal(absent.silenceIntervals[0].endSec, 1);
  assert.doesNotMatch(JSON.stringify(absent), /penalty|dead air/i);
});
