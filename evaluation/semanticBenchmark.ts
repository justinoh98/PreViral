import type { CapabilityTier, LocalExecutionProvider, SemanticState } from './contracts';

export const BENCHMARK_SCHEMA_VERSION = 'semantic-benchmark-v1';
export const BENCHMARK_MANIFEST_VERSION = 'semantic-benchmark-manifest-v1';
export type BenchmarkTask = 'subject_object_precision' | 'action_state_accuracy' | 'meaningful_progression' | 'repetition_classification' | 'opening_interpretation' | 'payoff_ending_relationship' | 'ocr_accuracy' | 'asr_accuracy' | 'unknown_calibration' | 'evidence_reference_validity';
const BENCHMARK_TASKS: BenchmarkTask[] = ['subject_object_precision', 'action_state_accuracy', 'meaningful_progression', 'repetition_classification', 'opening_interpretation', 'payoff_ending_relationship', 'ocr_accuracy', 'asr_accuracy', 'unknown_calibration', 'evidence_reference_validity'];
const SEMANTIC_STATES: SemanticState[] = ['observed', 'not_observed', 'unknown', 'not_applicable'];
export type BenchmarkFixture = {
  id: string; source: { kind: 'synthetic' | 'local_file'; locator: string }; frameCount: number;
  referenceIds: { evidenceIds: string[]; frameIds: string[]; shotIds: string[] };
  expectedObservations: Array<{ kind: string; state: SemanticState; value: string | null; tasks: BenchmarkTask[] }>;
  language: 'en' | 'ko' | 'not_applicable'; scenario: 'standard' | 'creative_exception';
  tags: BenchmarkTask[];
};
export type BenchmarkFixtureDefinition = Omit<BenchmarkFixture, 'id'>;
export type BenchmarkManifest = { version: typeof BENCHMARK_MANIFEST_VERSION; fixtures: Record<string, BenchmarkFixtureDefinition> };
export type BenchmarkOutput = {
  capabilityTier: CapabilityTier; confidence: number;
  observations: Array<{ kind: string; state: SemanticState; value: string | null; evidenceIds: string[]; frameIds: string[]; shotIds: string[] }>;
};
export type BenchmarkEnvironment = { platform: string; browser: string; deviceClass: 'desktop' | 'android' | 'iphone' | 'other' };
export type BenchmarkModelArtifact = { id: string; revision: string; checksum: string; license: string; assetBytes: number; delivery: 'self_hosted' | 'local_fixture' };
export type BenchmarkAdapter = {
  id: string; version: string; executionProvider: Exclude<LocalExecutionProvider, 'none'>;
  runtime: { id: string; version: string }; models: BenchmarkModelArtifact[];
  requestedTier?: CapabilityTier;
  load: (mode: 'cold' | 'warm') => Promise<void>;
  infer: (fixture: BenchmarkFixture) => Promise<BenchmarkOutput>;
  cleanup: () => Promise<void>;
};
export type BenchmarkResult = {
  version: typeof BENCHMARK_SCHEMA_VERSION; status: 'complete' | 'partial' | 'failed';
  adapter: { id: string; version: string; executionProvider: Exclude<LocalExecutionProvider, 'none'>; runtime: { id: string; version: string }; models: BenchmarkModelArtifact[] };
  environment: BenchmarkEnvironment; completion: { completedFixtures: number; totalFixtures: number };
  timings: { coldLoadMs: number | null; warmLoadMs: number | null; inferenceTotalMs: number | null; perFrameMs: number | null; totalSemanticAnalysisMs: number | null };
  memory: { measurable: boolean; beforeBytes: number | null; peakObservedBytes: number | null; afterBytes: number | null; sampleIntervalMs: number };
  correctness: { expectedObservationAccuracy: number | null; expectedObservationPrecision: number | null; expectedObservationRecall: number | null; evidenceReferenceValidity: number | null; taskMetrics: Partial<Record<BenchmarkTask, { correct: number; total: number }>> };
  outputConfidence: { mean: number | null; samples: number };
  capabilityTiers: CapabilityTier[];
  downgrades: Array<{ fixtureId: string; from: CapabilityTier; to: CapabilityTier }>;
  fixtureResults: Array<{ fixtureId: string; latencyMs: number; frameCount: number; language: BenchmarkFixture['language']; scenario: BenchmarkFixture['scenario']; output: BenchmarkOutput }>;
  failures: Array<{ stage: 'cold_load' | 'warm_load' | 'inference' | 'cleanup'; fixtureId: string | null; code: string; message: string }>;
};

type BenchmarkInstrumentation = { now?: () => number; memoryBytes?: () => number | null; memorySampleIntervalMs?: number; environment: BenchmarkEnvironment };
const rounded = (value: number) => Number(value.toFixed(3));
const errorRecord = (stage: BenchmarkResult['failures'][number]['stage'], error: unknown, fixtureId: string | null = null) => ({ stage, fixtureId, code: typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : 'unknown_failure', message: error instanceof Error ? error.message : 'Unknown benchmark failure.' });
const failedTaskMetrics = (fixtures: BenchmarkFixture[]): BenchmarkResult['correctness']['taskMetrics'] => Object.fromEntries(BENCHMARK_TASKS.flatMap(task => {
  const tagged = fixtures.filter(fixture => fixture.tags.includes(task));
  if (!tagged.length) return [];
  const total = tagged.reduce((sum, fixture) => task === 'evidence_reference_validity' ? sum + 1 : sum + Math.max(1, fixture.expectedObservations.filter(observation => observation.tasks.includes(task)).length), 0);
  return [[task, { correct: 0, total }]];
}));
const hasExactKeys = (value: object, keys: string[]) => {
  const actual = Object.keys(value).sort(); const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

export function validateBenchmarkManifest(manifest: BenchmarkManifest): void {
  if (!manifest || !hasExactKeys(manifest, ['version', 'fixtures']) || manifest.version !== BENCHMARK_MANIFEST_VERSION || !manifest.fixtures || Array.isArray(manifest.fixtures) || typeof manifest.fixtures !== 'object' || !Object.keys(manifest.fixtures).length) throw new Error('Invalid semantic benchmark manifest.');
  for (const [id, definition] of Object.entries(manifest.fixtures)) {
    const fixture: BenchmarkFixture = { id, ...definition };
    if (!definition || !hasExactKeys(definition, ['source', 'frameCount', 'referenceIds', 'expectedObservations', 'language', 'scenario', 'tags']) || !fixture.source || !hasExactKeys(fixture.source, ['kind', 'locator']) || !fixture.referenceIds || !hasExactKeys(fixture.referenceIds, ['evidenceIds', 'frameIds', 'shotIds'])) throw new Error('Benchmark fixture structure is invalid.');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(fixture.id) || !Number.isInteger(fixture.frameCount) || fixture.frameCount < 1) throw new Error('Benchmark fixtures require canonical IDs and a positive frame count.');
    if (fixture.source.kind === 'local_file') {
      if (!/^tests\/media\/local-benchmarks\/[A-Za-z0-9._/-]+$/.test(fixture.source.locator) || fixture.source.locator.includes('..')) throw new Error('Real benchmark media must remain under tests/media/local-benchmarks.');
    } else if (fixture.source.kind === 'synthetic') {
      if (!/^generated:\S+$/.test(fixture.source.locator)) throw new Error('Synthetic benchmark fixtures must use a generated locator.');
    } else throw new Error('Remote benchmark media is not supported.');
    if (/^[a-z]+:\/\//i.test(fixture.source.locator)) throw new Error('Remote benchmark media is not supported.');
    for (const field of ['evidenceIds', 'frameIds', 'shotIds'] as const) {
      const values = fixture.referenceIds?.[field];
      if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !value) || new Set(values).size !== values.length) throw new Error(`Benchmark ${field} must contain unique strings.`);
    }
    if (!Array.isArray(fixture.expectedObservations) || fixture.expectedObservations.some(row => !row || !hasExactKeys(row, ['kind', 'state', 'value', 'tasks']) || typeof row.kind !== 'string' || !row.kind || !SEMANTIC_STATES.includes(row.state) || (row.state === 'observed' ? typeof row.value !== 'string' || !row.value : row.value !== null) || !Array.isArray(row.tasks) || !row.tasks.length || row.tasks.some(task => !BENCHMARK_TASKS.includes(task) || !fixture.tags.includes(task)) || new Set(row.tasks).size !== row.tasks.length)) throw new Error('Benchmark expected observations are invalid.');
    if (new Set(fixture.expectedObservations.map(row => `${row.kind}:${row.state}:${JSON.stringify(row.value)}`)).size !== fixture.expectedObservations.length) throw new Error('Benchmark expected observations must be unique.');
    if (!['en', 'ko', 'not_applicable'].includes(fixture.language) || !['standard', 'creative_exception'].includes(fixture.scenario)) throw new Error('Benchmark language or scenario is invalid.');
    if (!Array.isArray(fixture.tags) || !fixture.tags.length || fixture.tags.some(tag => !BENCHMARK_TASKS.includes(tag)) || new Set(fixture.tags).size !== fixture.tags.length) throw new Error('Benchmark task tags are invalid.');
  }
}

function validateBenchmarkOutput(output: BenchmarkOutput, fixture: BenchmarkFixture): void {
  if (!output || !['high', 'medium', 'low'].includes(output.capabilityTier) || !Number.isFinite(output.confidence) || output.confidence < 0 || output.confidence > 1 || !Array.isArray(output.observations)) throw Object.assign(new Error('Benchmark output is invalid.'), { code: 'invalid_output' });
  for (const observation of output.observations) {
    if (!observation || !hasExactKeys(observation, ['kind', 'state', 'value', 'evidenceIds', 'frameIds', 'shotIds']) || typeof observation.kind !== 'string' || !observation.kind || !SEMANTIC_STATES.includes(observation.state) || (observation.state === 'observed' ? typeof observation.value !== 'string' || !observation.value : observation.value !== null)) throw Object.assign(new Error('Benchmark observation is invalid.'), { code: 'invalid_output' });
    for (const field of ['evidenceIds', 'frameIds', 'shotIds'] as const) if (!Array.isArray(observation[field]) || observation[field].some(id => typeof id !== 'string') || new Set(observation[field]).size !== observation[field].length) throw Object.assign(new Error('Benchmark observation references are invalid.'), { code: 'invalid_output' });
  }
}

export async function runSemanticBenchmark(adapter: BenchmarkAdapter, fixtures: BenchmarkFixture[], instrumentation: BenchmarkInstrumentation): Promise<BenchmarkResult> {
  if (new Set(fixtures.map(fixture => fixture.id)).size !== fixtures.length) throw new Error('Benchmark fixture IDs must be unique.');
  const manifestFixtures = Object.fromEntries(fixtures.map(({ id, ...definition }) => [id, definition]));
  validateBenchmarkManifest({ version: BENCHMARK_MANIFEST_VERSION, fixtures: manifestFixtures });
  if (!adapter.id || !adapter.version || !adapter.runtime?.id || !adapter.runtime.version || !Array.isArray(adapter.models) || !adapter.models.length || adapter.models.some(model => !model.id || !model.revision || !/^sha256-[a-f0-9]{64}$/.test(model.checksum) || !model.license || !Number.isInteger(model.assetBytes) || model.assetBytes < 1 || !['self_hosted', 'local_fixture'].includes(model.delivery))) throw new Error('Benchmark adapter manifest is invalid.');
  if (!instrumentation?.environment || !instrumentation.environment.platform || !instrumentation.environment.browser || !['desktop', 'android', 'iphone', 'other'].includes(instrumentation.environment.deviceClass)) throw new Error('Benchmark environment metadata is required.');
  const now = instrumentation.now ?? (() => performance.now());
  const memory = instrumentation.memoryBytes ?? (() => {
    const candidate = performance as Performance & { memory?: { usedJSHeapSize?: number } };
    return Number.isFinite(candidate.memory?.usedJSHeapSize) ? candidate.memory!.usedJSHeapSize! : null;
  });
  const sampleIntervalMs = instrumentation.memorySampleIntervalMs ?? 25;
  if (!Number.isInteger(sampleIntervalMs) || sampleIntervalMs < 1) throw new Error('Benchmark memory sample interval must be a positive integer.');
  const beforeBytes = memory(); const samples: Array<number> = beforeBytes === null ? [] : [beforeBytes];
  const sampleMemory = () => { const value = memory(); if (value !== null) samples.push(value); };
  const observeMemoryDuring = async <T>(operation: () => Promise<T>): Promise<T> => {
    sampleMemory(); const interval = setInterval(sampleMemory, sampleIntervalMs);
    try { return await operation(); } finally { clearInterval(interval); sampleMemory(); }
  };
  const failures: BenchmarkResult['failures'] = []; const fixtureResults: BenchmarkResult['fixtureResults'] = [];
  let coldLoadMs: number | null = null; let warmLoadMs: number | null = null;
  const base = { version: BENCHMARK_SCHEMA_VERSION, adapter: { id: adapter.id, version: adapter.version, executionProvider: adapter.executionProvider, runtime: { ...adapter.runtime }, models: adapter.models.map(model => ({ ...model })) }, environment: { ...instrumentation.environment } } as const;
  let start = now();
  try { await observeMemoryDuring(() => adapter.load('cold')); coldLoadMs = rounded(now() - start); }
  catch (error) {
    failures.push(errorRecord('cold_load', error));
    try { await observeMemoryDuring(() => adapter.cleanup()); } catch (cleanupError) { failures.push(errorRecord('cleanup', cleanupError)); }
    const afterBytes = memory(); if (afterBytes !== null) samples.push(afterBytes);
    return { ...base, status: 'failed', completion: { completedFixtures: 0, totalFixtures: fixtures.length }, timings: { coldLoadMs: null, warmLoadMs: null, inferenceTotalMs: null, perFrameMs: null, totalSemanticAnalysisMs: null }, memory: { measurable: samples.length > 0, beforeBytes, peakObservedBytes: samples.length ? Math.max(...samples) : null, afterBytes, sampleIntervalMs }, correctness: { expectedObservationAccuracy: 0, expectedObservationPrecision: 0, expectedObservationRecall: 0, evidenceReferenceValidity: null, taskMetrics: failedTaskMetrics(fixtures) }, outputConfidence: { mean: null, samples: 0 }, capabilityTiers: [], downgrades: [], fixtureResults, failures };
  }
  try { await observeMemoryDuring(() => adapter.cleanup()); } catch (error) { failures.push(errorRecord('cleanup', error)); }
  start = now();
  try { await observeMemoryDuring(() => adapter.load('warm')); warmLoadMs = rounded(now() - start); }
  catch (error) { failures.push(errorRecord('warm_load', error)); }
  if (warmLoadMs !== null) for (const fixture of fixtures) {
    const inferenceStart = now();
    try {
      const output = await observeMemoryDuring(() => adapter.infer(fixture));
      validateBenchmarkOutput(output, fixture);
      fixtureResults.push({ fixtureId: fixture.id, latencyMs: rounded(now() - inferenceStart), frameCount: fixture.frameCount, language: fixture.language, scenario: fixture.scenario, output });
    } catch (error) { failures.push(errorRecord('inference', error, fixture.id)); }
  }
  try { await observeMemoryDuring(() => adapter.cleanup()); } catch (error) { failures.push(errorRecord('cleanup', error)); }
  const afterBytes = memory(); if (afterBytes !== null) samples.push(afterBytes);
  const inferenceTotal = fixtureResults.reduce((sum, result) => sum + result.latencyMs, 0);
  const frameTotal = fixtureResults.reduce((sum, result) => sum + result.frameCount, 0);
  let accuracyTotal = 0; let precisionTotal = 0; let recallTotal = 0; let validRefObservations = 0; let totalRefObservations = 0;
  const taskMetrics: BenchmarkResult['correctness']['taskMetrics'] = {};
  for (const fixture of fixtures) {
    const result = fixtureResults.find(item => item.fixtureId === fixture.id);
    const expectedSet = new Set(fixture.expectedObservations.map(row => `${row.kind}:${row.state}:${JSON.stringify(row.value)}`));
    const predictedSet = new Set(result?.output.observations.map(row => `${row.kind}:${row.state}:${JSON.stringify(row.value)}`) ?? []);
    let expectedCorrect = 0;
    for (const expected of expectedSet) if (predictedSet.has(expected)) expectedCorrect++;
    const observationUnion = expectedSet.size + predictedSet.size - expectedCorrect;
    const accuracy = result ? (observationUnion ? expectedCorrect / observationUnion : 1) : 0;
    const precision = result ? (predictedSet.size ? expectedCorrect / predictedSet.size : expectedSet.size ? 0 : 1) : 0;
    const recall = result ? (expectedSet.size ? expectedCorrect / expectedSet.size : 1) : 0;
    accuracyTotal += accuracy; precisionTotal += precision; recallTotal += recall;
    const known = { evidenceIds: new Set(fixture.referenceIds.evidenceIds), frameIds: new Set(fixture.referenceIds.frameIds), shotIds: new Set(fixture.referenceIds.shotIds) };
    let fixtureReferencesValid = true;
    for (const observation of result?.output.observations ?? []) {
      totalRefObservations++;
      if ((['evidenceIds', 'frameIds', 'shotIds'] as const).every(field => observation[field].length > 0 && observation[field].every(id => known[field].has(id)))) validRefObservations++;
      else fixtureReferencesValid = false;
    }
    for (const task of fixture.tags) {
      const aggregate = taskMetrics[task] ?? { correct: 0, total: 0 };
      if (task === 'evidence_reference_validity') {
        const outputCount = result?.output.observations.length ?? 0;
        aggregate.total += Math.max(1, outputCount);
        aggregate.correct += result ? (outputCount ? result.output.observations.filter(observation => (['evidenceIds', 'frameIds', 'shotIds'] as const).every(field => observation[field].length > 0 && observation[field].every(id => known[field].has(id)))).length : 1) : 0;
      } else {
        const expectedForTask = fixture.expectedObservations.filter(row => row.tasks.includes(task));
        if (expectedForTask.length) {
          aggregate.total += expectedForTask.length;
          if (result) for (const expected of expectedForTask) if (predictedSet.has(`${expected.kind}:${expected.state}:${JSON.stringify(expected.value)}`)) aggregate.correct++;
        } else {
          aggregate.total++;
          if (result && result.output.observations.length === 0) aggregate.correct++;
        }
      }
      taskMetrics[task] = aggregate;
    }
  }
  const confidences = fixtureResults.map(result => result.output.confidence);

  const tierRank: Record<CapabilityTier, number> = { low: 0, medium: 1, high: 2 };
  const downgrades = adapter.requestedTier ? fixtureResults.flatMap(result => tierRank[result.output.capabilityTier] < tierRank[adapter.requestedTier!] ? [{ fixtureId: result.fixtureId, from: adapter.requestedTier!, to: result.output.capabilityTier }] : []) : [];
  return {
    ...base, status: failures.length ? (fixtureResults.length ? 'partial' : 'failed') : 'complete', completion: { completedFixtures: fixtureResults.length, totalFixtures: fixtures.length },
    timings: { coldLoadMs, warmLoadMs, inferenceTotalMs: fixtureResults.length ? rounded(inferenceTotal) : null, perFrameMs: frameTotal ? rounded(inferenceTotal / frameTotal) : null, totalSemanticAnalysisMs: warmLoadMs !== null && fixtureResults.length ? rounded(warmLoadMs + inferenceTotal) : null },
    memory: { measurable: samples.length > 0, beforeBytes, peakObservedBytes: samples.length ? Math.max(...samples) : null, afterBytes, sampleIntervalMs },
    correctness: { expectedObservationAccuracy: rounded(accuracyTotal / fixtures.length), expectedObservationPrecision: rounded(precisionTotal / fixtures.length), expectedObservationRecall: rounded(recallTotal / fixtures.length), evidenceReferenceValidity: totalRefObservations ? rounded(validRefObservations / totalRefObservations) : null, taskMetrics },
    outputConfidence: { mean: confidences.length ? rounded(confidences.reduce((sum, value) => sum + value, 0) / confidences.length) : null, samples: confidences.length },
    capabilityTiers: [...new Set(fixtureResults.map(result => result.output.capabilityTier))], downgrades, fixtureResults, failures,
  };
}
