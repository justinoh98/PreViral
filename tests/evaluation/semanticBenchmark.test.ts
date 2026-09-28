import test from 'node:test';
import assert from 'node:assert/strict';
import { runSemanticBenchmark, validateBenchmarkManifest, type BenchmarkAdapter, type BenchmarkFixture } from '../../evaluation/semanticBenchmark';

const fixture: BenchmarkFixture = {
  id: 'synthetic-opening', source: { kind: 'synthetic', locator: 'generated:solid-to-split' }, frameCount: 2,
  referenceIds: { evidenceIds: ['E1'], frameIds: ['F1', 'F2'], shotIds: ['S1'] },
  expectedObservations: [{ kind: 'opening_subject', state: 'observed', value: 'model car', tasks: ['opening_interpretation'] }], language: 'not_applicable', scenario: 'standard', tags: ['opening_interpretation'],
};
const adapterManifest = { runtime: { id: 'fixture-runtime', version: 'v1' }, models: [{ id: 'fixture-model', revision: 'fixture-v1', checksum: `sha256-${'a'.repeat(64)}`, license: 'test-only', assetBytes: 1, delivery: 'local_fixture' as const }] };
const benchmarkEnvironment = { platform: 'node-test', browser: 'none', deviceClass: 'other' as const };
const benchmarkManifest = (...fixtures: BenchmarkFixture[]) => ({ version: 'semantic-benchmark-manifest-v1' as const, fixtures: Object.fromEntries(fixtures.map(({ id, ...definition }) => [id, definition])) });

test('benchmark harness measures cold/warm load, per-frame and total inference without invented model results', async () => {
  let now = 0;
  const adapter: BenchmarkAdapter = {
    id: 'fixture-adapter', version: 'v1', executionProvider: 'wasm', requestedTier: 'high', ...adapterManifest,
    load: async mode => { now += mode === 'cold' ? 10 : 3; },
    infer: async input => { now += 8; return { capabilityTier: 'medium', confidence: .75, observations: [{ kind: 'opening_subject', state: 'observed', value: 'model car', evidenceIds: ['E1'], frameIds: ['F1'], shotIds: ['S1'] }] }; },
    cleanup: async () => { now += 1; },
  };
  const result = await runSemanticBenchmark(adapter, [fixture], { now: () => now, memoryBytes: () => 1000 + now, environment: benchmarkEnvironment });
  assert.equal(result.status, 'complete');
  assert.equal(result.timings.coldLoadMs, 10);
  assert.equal(result.timings.warmLoadMs, 3);
  assert.equal(result.timings.inferenceTotalMs, 8);
  assert.equal(result.timings.perFrameMs, 4);
  assert.equal(result.correctness.expectedObservationAccuracy, 1);
  assert.equal(result.correctness.expectedObservationPrecision, 1);
  assert.equal(result.correctness.expectedObservationRecall, 1);
  assert.equal(result.correctness.evidenceReferenceValidity, 1);
  assert.equal(result.outputConfidence.mean, .75);
  assert.equal(result.memory.measurable, true);
  assert.equal(result.adapter.executionProvider, 'wasm');
  assert.deepEqual(result.fixtureResults[0], { ...result.fixtureResults[0], language: 'not_applicable', scenario: 'standard' });
  assert.deepEqual(result.downgrades, [{ fixtureId: 'synthetic-opening', from: 'high', to: 'medium' }]);
});

test('worker or device failure is explicit and leaves unavailable timing fields null', async () => {
  const multiObservationFixture = structuredClone(fixture);
  multiObservationFixture.expectedObservations.push({ kind: 'opening_action', state: 'observed', value: 'assembly starts', tasks: ['opening_interpretation'] });
  const adapter: BenchmarkAdapter = {
    id: 'failing', version: 'v1', executionProvider: 'webgpu', ...adapterManifest,
    load: async mode => { if (mode === 'cold') throw Object.assign(new Error('device lost'), { code: 'device_lost' }); },
    infer: async () => { throw new Error('must not run'); }, cleanup: async () => {},
  };
  const result = await runSemanticBenchmark(adapter, [multiObservationFixture], { environment: benchmarkEnvironment });
  assert.equal(result.status, 'failed');
  assert.equal(result.timings.coldLoadMs, null);
  assert.equal(result.timings.inferenceTotalMs, null);
  assert.equal(result.failures[0].code, 'device_lost');
  assert.equal(result.fixtureResults.length, 0);
  assert.deepEqual(result.correctness.taskMetrics.opening_interpretation, { correct: 0, total: 2 });
});

test('benchmark manifests allow synthetic and ignored local media but reject remote or traversal sources', () => {
  assert.doesNotThrow(() => validateBenchmarkManifest(benchmarkManifest(fixture)));
  const local = structuredClone(fixture); local.source = { kind: 'local_file', locator: 'tests/media/local-benchmarks/private-reel.mp4' };
  assert.doesNotThrow(() => validateBenchmarkManifest(benchmarkManifest(local)));
  for (const locator of ['https://example.com/video.mp4', '../private.mp4', 'tests/media/other/video.mp4']) {
    local.source.locator = locator;
    assert.throws(() => validateBenchmarkManifest(benchmarkManifest(local)));
  }
});

test('semantic correctness penalizes false positives and missing evidence references', async () => {
  const adapter: BenchmarkAdapter = {
    id: 'false-positive', version: 'v1', executionProvider: 'wasm', ...adapterManifest, load: async () => {}, cleanup: async () => {},
    infer: async () => ({ capabilityTier: 'low', confidence: .9, observations: [
      { kind: 'opening_subject', state: 'observed', value: 'model car', evidenceIds: [], frameIds: [], shotIds: [] },
      { kind: 'invented_payoff', state: 'observed', value: 'invented', evidenceIds: [], frameIds: [], shotIds: [] },
    ] }),
  };
  const result = await runSemanticBenchmark(adapter, [fixture], { environment: benchmarkEnvironment });
  assert.equal(result.correctness.expectedObservationAccuracy, .5);
  assert.equal(result.correctness.expectedObservationPrecision, .5);
  assert.equal(result.correctness.expectedObservationRecall, 1);
  assert.equal(result.correctness.evidenceReferenceValidity, 0);
});

test('manifest and adapter output validation reject malformed benchmark data', async () => {
  const malformed = structuredClone(fixture) as any;
  malformed.referenceIds.frameIds = ['F1', 'F1'];
  assert.throws(() => validateBenchmarkManifest(benchmarkManifest(malformed)));
  malformed.referenceIds.frameIds = ['F1']; malformed.tags = [];
  assert.throws(() => validateBenchmarkManifest(benchmarkManifest(malformed)));
  const adapter: BenchmarkAdapter = {
    id: 'invalid-output', version: 'v1', executionProvider: 'wasm', ...adapterManifest, load: async () => {}, cleanup: async () => {},
    infer: async () => ({ capabilityTier: 'low', confidence: 2, observations: [] }),
  };
  const result = await runSemanticBenchmark(adapter, [fixture], { environment: benchmarkEnvironment });
  assert.equal(result.status, 'failed');
  assert.equal(result.failures[0].code, 'invalid_output');
});

test('failed fixtures remain in correctness and task denominators', async () => {
  const difficult = structuredClone(fixture); difficult.id = 'difficult'; difficult.tags = ['meaningful_progression']; difficult.expectedObservations[0].tasks = ['meaningful_progression'];
  const adapter: BenchmarkAdapter = {
    id: 'partial', version: 'v1', executionProvider: 'wasm', ...adapterManifest, load: async () => {}, cleanup: async () => {},
    infer: async input => {
      if (input.id === 'difficult') throw new Error('inference failed');
      return { capabilityTier: 'low', confidence: .8, observations: [{ kind: 'opening_subject', state: 'observed', value: 'model car', evidenceIds: ['E1'], frameIds: ['F1'], shotIds: ['S1'] }] };
    },
  };
  const result = await runSemanticBenchmark(adapter, [fixture, difficult], { environment: benchmarkEnvironment });
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.completion, { completedFixtures: 1, totalFixtures: 2 });
  assert.equal(result.correctness.expectedObservationAccuracy, .5);
  assert.deepEqual(result.correctness.taskMetrics.meaningful_progression, { correct: 0, total: 1 });
});

test('empty expected-observation fixtures score a correct abstention', async () => {
  const abstention = structuredClone(fixture); abstention.id = 'creative-exception'; abstention.expectedObservations = []; abstention.scenario = 'creative_exception'; abstention.tags = ['unknown_calibration'];
  const adapter: BenchmarkAdapter = {
    id: 'abstaining', version: 'v1', executionProvider: 'wasm', ...adapterManifest, load: async () => {}, cleanup: async () => {},
    infer: async () => ({ capabilityTier: 'low', confidence: .7, observations: [] }),
  };
  const result = await runSemanticBenchmark(adapter, [abstention], { environment: benchmarkEnvironment });
  assert.equal(result.correctness.expectedObservationAccuracy, 1);
  assert.equal(result.correctness.expectedObservationPrecision, 1);
  assert.equal(result.correctness.expectedObservationRecall, 1);
  assert.deepEqual(result.correctness.taskMetrics.unknown_calibration, { correct: 1, total: 1 });
});

test('task metrics use observation-level truth instead of whole-fixture accuracy', async () => {
  const mixed = structuredClone(fixture);
  mixed.tags = ['opening_interpretation', 'payoff_ending_relationship'];
  mixed.expectedObservations.push({ kind: 'opening_action', state: 'observed', value: 'assembly starts', tasks: ['opening_interpretation'] });
  mixed.expectedObservations.push({ kind: 'ending_payoff', state: 'observed', value: 'finished model', tasks: ['payoff_ending_relationship'] });
  const adapter: BenchmarkAdapter = {
    id: 'task-specific', version: 'v1', executionProvider: 'wasm', ...adapterManifest, load: async () => {}, cleanup: async () => {},
    infer: async () => ({ capabilityTier: 'low', confidence: .8, observations: [{ kind: 'opening_subject', state: 'observed', value: 'model car', evidenceIds: ['E1'], frameIds: ['F1'], shotIds: ['S1'] }] }),
  };
  const result = await runSemanticBenchmark(adapter, [mixed], { environment: benchmarkEnvironment });
  assert.deepEqual(result.correctness.taskMetrics.opening_interpretation, { correct: 1, total: 2 });
  assert.deepEqual(result.correctness.taskMetrics.payoff_ending_relationship, { correct: 0, total: 1 });
});

test('memory sampling observes values during asynchronous inference', async () => {
  let memory = 100;
  const adapter: BenchmarkAdapter = {
    id: 'memory-sampling', version: 'v1', executionProvider: 'wasm', ...adapterManifest, load: async () => {}, cleanup: async () => {},
    infer: async () => {
      memory = 900;
      await new Promise(resolve => setTimeout(resolve, 8));
      memory = 200;
      return { capabilityTier: 'low', confidence: .8, observations: [{ kind: 'opening_subject', state: 'observed', value: 'model car', evidenceIds: ['E1'], frameIds: ['F1'], shotIds: ['S1'] }] };
    },
  };
  const result = await runSemanticBenchmark(adapter, [fixture], { environment: benchmarkEnvironment, memoryBytes: () => memory, memorySampleIntervalMs: 1 });
  assert.equal(result.memory.peakObservedBytes, 900);
  assert.equal(result.memory.sampleIntervalMs, 1);
});
