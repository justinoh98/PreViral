import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceDebugSnapshot } from '../../src/evaluation/evidenceDebug';
import { analyzeAudioSamples, analyzeVisualFrames, type PixelFrame } from '../../evaluation/mediaAnalysis';

const frame = (id: string, timeSec: number, value: number): PixelFrame => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let index = 0; index < pixels.length; index += 4) pixels.set([value, value, value, 255], index);
  return { id, timeSec, width: 8, height: 8, pixels };
};

test('debug snapshot exposes identity, versions, evidence provenance, visual, audio, text, and technical states', () => {
  const fingerprint = 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const evidence = analyzeVisualFrames([frame('a', 0, 20), frame('b', .5, 220), frame('c', .999, 20)], 1, fingerprint);
  evidence.audio = analyzeAudioSamples(new Float32Array(1000), 1000, fingerprint);
  const snapshot = buildEvidenceDebugSnapshot(fingerprint, evidence, []);

  assert.equal(snapshot.fingerprint, fingerprint);
  assert.equal(snapshot.analyzerVersion, evidence.version);
  assert.equal(snapshot.schemaVersion, evidence.schemaVersion);
  assert.ok(snapshot.shots[0].id);
  assert.ok('boundaryConfidence' in snapshot.shots[0]);
  assert.ok(snapshot.measurements[0].id);
  assert.ok(snapshot.opening.id);
  assert.ok(snapshot.ending.id);
  assert.equal(snapshot.audio.trackState, 'absent');
  assert.equal(snapshot.text.state, 'unavailable');
  assert.equal(snapshot.provenance, 'measured_local');
  assert.ok(snapshot.capabilities.length > 0);
  assert.ok(snapshot.technical.frameCount > 0);
});
