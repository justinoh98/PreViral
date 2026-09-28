import test from 'node:test';
import assert from 'node:assert/strict';
import { runSemanticBenchmark, type BenchmarkFixture } from '../../evaluation/semanticBenchmark';
import {
  CLIP_VIT_B32_ARTIFACT,
  SMOLVLM2_Q4_ARTIFACT,
  SMOLVLM2_Q4F16_ARTIFACT,
  createVisualFeasibilityBenchmarkAdapter,
  type VisualFeasibilityRuntime,
} from '../../evaluation/visualModelFeasibility';

const fixture: BenchmarkFixture = {
  id: 'two-frame-visual-probe',
  source: { kind: 'synthetic', locator: 'generated:phase-3a-two-frame' },
  frameCount: 2,
  referenceIds: { evidenceIds: [], frameIds: [], shotIds: [] },
  expectedObservations: [],
  language: 'not_applicable',
  scenario: 'standard',
  tags: ['unknown_calibration'],
};

test('pinned Phase 3.3A artifacts record exact browser files, sizes, and license gates', () => {
  assert.equal(SMOLVLM2_Q4F16_ARTIFACT.revision, '067788b187b95ebe7b2e040b3e4299e342e5b8fd');
  assert.equal(SMOLVLM2_Q4F16_ARTIFACT.weightBytes, 189_174_979);
  assert.equal(SMOLVLM2_Q4F16_ARTIFACT.browserArtifactLicense, 'verified');
  assert.equal(SMOLVLM2_Q4F16_ARTIFACT.components.length, 3);
  assert.ok(SMOLVLM2_Q4F16_ARTIFACT.components.every(component => /^[a-f0-9]{64}$/.test(component.sha256)));
  assert.equal(SMOLVLM2_Q4_ARTIFACT.weightBytes, 264_221_217);
  assert.equal(SMOLVLM2_Q4_ARTIFACT.approximateTotalBytes, 269_075_803);
  assert.equal(CLIP_VIT_B32_ARTIFACT.revision, 'd15189d7028b43f1d3e65039190477f6af591c2a');
  assert.equal(CLIP_VIT_B32_ARTIFACT.browserArtifactLicense, 'unverified');
  assert.match(CLIP_VIT_B32_ARTIFACT.blocker ?? '', /converted artifact license/i);
});

test('visual feasibility adapter reuses the benchmark harness and bounds multi-frame work', async () => {
  const lifecycle: string[] = [];
  const runtime: VisualFeasibilityRuntime = {
    load: async mode => { lifecycle.push(`load:${mode}`); return { downloadedBytes: mode === 'cold' ? 194_029_565 : 0 }; },
    infer: async input => { lifecycle.push(`infer:${input.id}`); return { text: 'The second frame changes from dark to light.', frameCount: input.frameCount }; },
    cleanup: async () => { lifecycle.push('cleanup'); },
  };
  const adapter = createVisualFeasibilityBenchmarkAdapter({
    artifact: SMOLVLM2_Q4F16_ARTIFACT,
    executionProvider: 'webgpu',
    requestedTier: 'high',
    maxFrames: 2,
    runtime,
  });
  const result = await runSemanticBenchmark(adapter, [fixture], { environment: { platform: 'test', browser: 'test', deviceClass: 'desktop' } });
  assert.equal(result.status, 'complete');
  assert.deepEqual(lifecycle, ['load:cold', 'cleanup', 'load:warm', 'infer:two-frame-visual-probe', 'cleanup']);
  assert.equal(adapter.diagnostics.loads[0].downloadedBytes, 194_029_565);
  assert.equal(adapter.diagnostics.outputs[0].text, 'The second frame changes from dark to light.');
  assert.equal(result.fixtureResults[0].output.capabilityTier, 'high');

  const oversized = { ...fixture, frameCount: 3 };
  await assert.rejects(() => adapter.infer(oversized), /frame budget/i);
});

test('visual feasibility adapter forwards cancellation and still permits cleanup', async () => {
  let aborted = false; let cleaned = false;
  const runtime: VisualFeasibilityRuntime = {
    load: async () => ({ downloadedBytes: 0 }),
    infer: async (_fixture, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    }),
    cleanup: async () => { cleaned = true; },
  };
  const adapter = createVisualFeasibilityBenchmarkAdapter({ artifact: SMOLVLM2_Q4F16_ARTIFACT, executionProvider: 'wasm', requestedTier: 'high', maxFrames: 2, runtime });
  await adapter.load('warm');
  const pending = adapter.infer(fixture);
  adapter.cancel();
  await assert.rejects(pending, error => error instanceof DOMException && error.name === 'AbortError');
  await adapter.cleanup();
  assert.equal(aborted, true);
  assert.equal(cleaned, true);
});
