import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleTimes, measurementTimes, frameDifference, selectSceneChangeTimes } from '../../src/evaluation/mediaEvidence';
test('adaptive selection preserves baseline coverage and adds both sides of important changes', () => {
  const base = sampleTimes(30); const selected = selectSceneChangeTimes(base, [{ before: 9.123, after: 9.373, difference: .8 }], 30);
  assert.ok(base.every(t => selected.includes(t))); assert.ok(selected.includes(9.123)); assert.ok(selected.includes(9.373));
  assert.ok(selected.every((t, i) => i === 0 || t > selected[i - 1]));
});
test('unchanged cinematic footage does not create fake scene changes', () => {
  const pixels = new Uint8ClampedArray([20, 30, 40, 255]); assert.equal(frameDifference(pixels, pixels), 0);
  assert.deepEqual(selectSceneChangeTimes(sampleTimes(15), [{ before: 2, after: 2.25, difference: 0 }], 15), sampleTimes(15));
});
test('measurement coverage is dense across the whole Reel while keyframe work stays bounded', () => {
  for (const duration of [.5, 3, 15, 30, 90, 300]) {
    const probes = measurementTimes(duration); assert.ok(probes.length <= 1230);
    assert.equal(probes[0], 0); assert.ok(probes.at(-1)! >= duration - .05);
    assert.ok(probes.every((time, index) => index === 0 || time - probes[index - 1] <= .251));
    if (duration >= 3) assert.ok(probes.filter(time => time <= 3).length >= 25);
    const selected = selectSceneChangeTimes(sampleTimes(duration), probes.slice(1).map((t, i) => ({ before: probes[i], after: t, difference: .9 })), duration);
    assert.ok(selected.length <= 96); assert.equal(selected[0], 0); assert.ok(selected.at(-1)! >= duration - .05);
  }
});
