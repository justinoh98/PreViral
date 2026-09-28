import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticWorkerHandler, ModelLoadFailure } from '../../src/evaluation/semantic/semanticWorkerCore';
import type { SemanticRuntimeCapabilities } from '../../src/evaluation/semantic/runtimeCapabilities';
import type { SemanticWorkerEvent } from '../../src/evaluation/semantic/workerProtocol';

const capabilities = (): SemanticRuntimeCapabilities => ({
  version: 'semantic-runtime-capabilities-v1', tier: 'high', webgpu: { state: 'available', maxBufferSize: 1, maxStorageBufferBindingSize: 1 },
  wasm: { state: 'available', simd: true, threads: true }, worker: { state: 'available' },
  browserFeatures: { offscreenCanvas: true, imageBitmap: true, audioContext: true, crossOriginIsolated: true },
  storage: { state: 'available', cacheStorage: true, indexedDb: true, quotaBytes: 100, availableBytes: 90 },
  memory: { deviceMemoryGb: 8, hardwareConcurrency: 8, constrained: false }, downgradeReasons: [], limitations: [],
  warmupProfile: { id: 'fixture-model', revision: 'v1', checksum: `sha256-${'a'.repeat(64)}`, assetBytes: 200_000_000, peakBytes: 1_500_000_000, largestBufferBytes: 250_000_000, providers: ['webgpu', 'wasm'] },
});

const eventTypes = (events: SemanticWorkerEvent[]) => events.map(event => event.type);

test('worker initialization reports real capability progress without semantic observations', async () => {
  const events: SemanticWorkerEvent[] = [];
  const handle = createSemanticWorkerHandler({ emit: event => events.push(event), probe: async () => capabilities() });
  await handle({ type: 'initialize', requestId: 'init-1' });
  assert.deepEqual(eventTypes(events), ['state', 'progress', 'capabilities', 'progress', 'state']);
  const finalEvent = events.at(-1);
  assert.equal(finalEvent?.type === 'state' ? finalEvent.status : null, 'ready');
  assert.doesNotMatch(JSON.stringify(events), /observations/);
});

test('worker cancellation and cleanup stop pending work and release the session', async () => {
  const events: SemanticWorkerEvent[] = [];
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const handle = createSemanticWorkerHandler({ emit: event => events.push(event), probe: async signal => { await blocked; if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); return capabilities(); } });
  const initializing = handle({ type: 'initialize', requestId: 'init-2' });
  await handle({ type: 'cancel', requestId: 'init-2' });
  release(); await initializing;
  await handle({ type: 'cleanup', requestId: 'cleanup-1' });
  assert.ok(events.some(event => event.type === 'state' && event.status === 'cancelled'));
  const finalEvent = events.at(-1);
  assert.equal(finalEvent?.type === 'state' ? finalEvent.status : null, 'cleaned');
});

test('model-load and worker failures remain explicit and produce no fake semantics', async () => {
  for (const failure of [new ModelLoadFailure('candidate unavailable', 'high', 'medium'), new Error('worker crashed')]) {
    const events: SemanticWorkerEvent[] = [];
    const handle = createSemanticWorkerHandler({ emit: event => events.push(event), probe: async () => { throw failure; } });
    await handle({ type: 'initialize', requestId: 'init-failure' });
    const error = events.find(event => event.type === 'error');
    assert.equal(error?.type, 'error');
    assert.equal(error && error.code, failure instanceof ModelLoadFailure ? 'model_load_failed' : 'worker_failed');
    assert.ok(events.some(event => event.type === 'state' && event.status === (failure instanceof ModelLoadFailure ? 'partial' : 'failed')));
    if (failure instanceof ModelLoadFailure) assert.ok(events.some(event => event.type === 'capability_downgrade' && event.to === 'medium'));
    assert.doesNotMatch(JSON.stringify(events), /semanticObservation/);
  }
});

test('unknown cancellation is ignored and duplicate active request IDs are rejected', async () => {
  const events: SemanticWorkerEvent[] = [];
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const handle = createSemanticWorkerHandler({ emit: event => events.push(event), probe: async () => { await blocked; return capabilities(); } });
  await handle({ type: 'cancel', requestId: 'missing' });
  assert.equal(events.length, 0);
  const first = handle({ type: 'initialize', requestId: 'same' });
  await handle({ type: 'initialize', requestId: 'same' });
  assert.ok(events.some(event => event.type === 'error' && event.code === 'duplicate_request'));
  release(); await first;
});

test('cleanup waits for cancellation and reports cleanup failures through the protocol', async () => {
  const events: SemanticWorkerEvent[] = [];
  const handle = createSemanticWorkerHandler({
    emit: event => events.push(event),
    probe: signal => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })),
    cleanup: async () => { throw new Error('cleanup exploded'); },
  });
  const pending = handle({ type: 'initialize', requestId: 'pending' });
  await handle({ type: 'cleanup', requestId: 'cleanup-failure' });
  await pending;
  assert.ok(events.some(event => event.type === 'state' && event.requestId === 'pending' && event.status === 'cancelled'));
  assert.ok(events.some(event => event.type === 'error' && event.code === 'cleanup_failed'));
  assert.ok(events.some(event => event.type === 'state' && event.requestId === 'cleanup-failure' && event.status === 'failed'));
});

test('cleanup is bounded when active work and resource cleanup ignore cancellation', async () => {
  const events: SemanticWorkerEvent[] = [];
  let cleanupCalled = false;
  const handle = createSemanticWorkerHandler({
    emit: event => events.push(event), probe: () => new Promise(() => {}), cleanup: () => { cleanupCalled = true; return new Promise(() => {}); }, cleanupTimeoutMs: 5,
  });
  void handle({ type: 'initialize', requestId: 'hung' });
  await handle({ type: 'cleanup', requestId: 'bounded-cleanup' });
  assert.ok(events.some(event => event.type === 'error' && event.requestId === 'bounded-cleanup' && event.code === 'cleanup_failed'));
  assert.ok(events.some(event => event.type === 'state' && event.requestId === 'bounded-cleanup' && event.status === 'failed'));
  assert.equal(cleanupCalled, true);
});

test('repeated and concurrent cleanup release resources exactly once', async () => {
  const events: SemanticWorkerEvent[] = [];
  let cleanupCalls = 0;
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const handle = createSemanticWorkerHandler({ emit: event => events.push(event), probe: async () => capabilities(), cleanup: async () => { cleanupCalls++; await blocked; } });
  const first = handle({ type: 'cleanup', requestId: 'cleanup-a' });
  const second = handle({ type: 'cleanup', requestId: 'cleanup-b' });
  release();
  await Promise.all([first, second]);
  await handle({ type: 'cleanup', requestId: 'cleanup-c' });
  assert.equal(cleanupCalls, 1);
  for (const requestId of ['cleanup-a', 'cleanup-b', 'cleanup-c']) assert.ok(events.some(event => event.type === 'state' && event.requestId === requestId && event.status === 'cleaned'));
});
