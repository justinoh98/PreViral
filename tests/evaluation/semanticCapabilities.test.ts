import test from 'node:test';
import assert from 'node:assert/strict';
import { browserCapabilityEnvironment, detectSemanticRuntimeCapabilities, type CapabilityEnvironment } from '../../src/evaluation/semantic/runtimeCapabilities';

const environment = (overrides: Partial<CapabilityEnvironment> = {}): CapabilityEnvironment => ({
  worker: true, wasm: true, wasmSimd: true, wasmThreads: true, crossOriginIsolated: true,
  offscreenCanvas: true, imageBitmap: true, audioContext: true, cacheStorage: true, indexedDb: true,
  hardwareConcurrency: 8, deviceMemoryGb: 8,
  warmupProfile: { id: 'fixture-model', revision: 'immutable-v1', checksum: `sha256-${'a'.repeat(64)}`, assetBytes: 200_000_000, peakBytes: 1_500_000_000, largestBufferBytes: 250_000_000, providers: ['webgpu', 'wasm'] },
  storageEstimate: async () => ({ quota: 2_000_000_000, usage: 100_000_000 }),
  requestWebGpuAdapter: async () => ({ maxBufferSize: 1_000_000_000, maxStorageBufferBindingSize: 500_000_000 }),
  webGpuWarmup: async profile => profile && ({ id: profile.id, revision: profile.revision, checksum: profile.checksum, allocatedBytes: profile.peakBytes }),
  wasmWarmup: async profile => profile && ({ id: profile.id, revision: profile.revision, checksum: profile.checksum, allocatedBytes: profile.peakBytes }),
  ...overrides,
});

test('successful WebGPU allocation signals and local browser foundations qualify for high tier', async () => {
  const result = await detectSemanticRuntimeCapabilities(environment());
  assert.equal(result.tier, 'high');
  assert.equal(result.webgpu.state, 'available');
  assert.equal(result.wasm.state, 'available');
  assert.equal(result.worker.state, 'available');
  assert.equal(result.storage.state, 'available');
  assert.equal(result.memory.deviceMemoryGb, 8);
});

test('strong WASM without WebGPU downgrades to medium and records the reason', async () => {
  const result = await detectSemanticRuntimeCapabilities(environment({ requestWebGpuAdapter: undefined }));
  assert.equal(result.tier, 'medium');
  assert.equal(result.webgpu.state, 'unavailable');
  assert.match(result.downgradeReasons.join(' '), /WebGPU/i);
});

test('API presence without a successful allocation warm-up cannot qualify as high capability', async () => {
  const result = await detectSemanticRuntimeCapabilities(environment({ webGpuWarmup: async () => null }));
  assert.equal(result.tier, 'medium');
  assert.equal(result.webgpu.state, 'unavailable');
  assert.match(result.limitations.join(' '), /warm-up/i);
});

test('WebGPU limits must support the candidate allocation plan before warm-up can qualify', async () => {
  let warmupCalled = false;
  const result = await detectSemanticRuntimeCapabilities(environment({
    requestWebGpuAdapter: async () => ({ maxBufferSize: 100_000_000, maxStorageBufferBindingSize: 100_000_000 }),
    webGpuWarmup: async profile => { warmupCalled = true; return profile && ({ id: profile.id, revision: profile.revision, checksum: profile.checksum, allocatedBytes: profile.peakBytes }); },
  }));
  assert.equal(result.tier, 'medium');
  assert.equal(result.webgpu.state, 'unavailable');
  assert.equal(warmupCalled, false);
  assert.match(result.limitations.join(' '), /buffer limits/i);
});

test('constrained memory and missing worker support force low tier without invented capabilities', async () => {
  const result = await detectSemanticRuntimeCapabilities(environment({ worker: false, deviceMemoryGb: 2, hardwareConcurrency: 2 }));
  assert.equal(result.tier, 'low');
  assert.equal(result.worker.state, 'unavailable');
  assert.ok(result.downgradeReasons.some(reason => /worker/i.test(reason)));
  assert.ok(result.downgradeReasons.some(reason => /memory/i.test(reason)));
});

test('failed probes are explicit and do not reject capability detection', async () => {
  const result = await detectSemanticRuntimeCapabilities(environment({
    requestWebGpuAdapter: async () => { throw new Error('device lost'); },
    storageEstimate: async () => { throw new Error('denied'); },
    deviceMemoryGb: null,
  }));
  assert.equal(result.webgpu.state, 'unavailable');
  assert.equal(result.storage.state, 'unknown');
  assert.equal(result.memory.deviceMemoryGb, null);
  assert.ok(result.limitations.length > 0);
});

test('API warm-up without a candidate-specific allocation profile remains low tier', async () => {
  const result = await detectSemanticRuntimeCapabilities(environment({ warmupProfile: null }));
  assert.equal(result.tier, 'low');
  assert.ok(result.downgradeReasons.some(reason => /candidate-specific/i.test(reason)));
});

test('a warm-up result must match the candidate revision, checksum, and measured allocation', async () => {
  const mismatch = async () => ({ id: 'fixture-model', revision: 'wrong', checksum: `sha256-${'b'.repeat(64)}`, allocatedBytes: 1 });
  const result = await detectSemanticRuntimeCapabilities(environment({ webGpuWarmup: mismatch, wasmWarmup: mismatch }));
  assert.equal(result.tier, 'low');
  assert.equal(result.warmupProfile, null);
});

test('abort and timeout bound hanging capability probes', async () => {
  const controller = new AbortController();
  const pending = detectSemanticRuntimeCapabilities(environment({ requestWebGpuAdapter: () => new Promise(() => {}) }), { signal: controller.signal, probeTimeoutMs: 1000 });
  controller.abort();
  await assert.rejects(pending, error => error instanceof DOMException && error.name === 'AbortError');
  const timed = await detectSemanticRuntimeCapabilities(environment({ requestWebGpuAdapter: () => new Promise(() => {}) }), { probeTimeoutMs: 5 });
  assert.equal(timed.webgpu.state, 'unavailable');
  assert.match(timed.limitations.join(' '), /timed out/i);
});

test('browser WebGPU warm-up observes scoped validation or allocation errors', async () => {
  const errors = [{ message: 'allocation rejected' }, null];
  const scope = {
    navigator: { gpu: { requestAdapter: async () => ({
      limits: { maxBufferSize: 1024, maxStorageBufferBindingSize: 1024 },
      requestDevice: async () => ({
        pushErrorScope: () => {}, popErrorScope: async () => errors.shift() ?? null,
        createBuffer: ({ size }: { size: number }) => ({ getMappedRange: () => new ArrayBuffer(size), unmap: () => {}, destroy: () => {} }),
        createBindGroupLayout: () => ({}), createBindGroup: () => ({}),
        createCommandEncoder: () => ({ clearBuffer: () => {}, finish: () => ({}) }),
        queue: { submit: () => {}, onSubmittedWorkDone: async () => {} }, destroy: () => {},
      }),
    }) } },
    WebAssembly, Worker: class {}, SharedArrayBuffer, Atomics, crossOriginIsolated: true,
    OffscreenCanvas: class {}, createImageBitmap: () => {}, AudioContext: class {}, caches: {}, indexedDB: {},
    GPUBufferUsage: { STORAGE: 128, COPY_DST: 8 }, GPUShaderStage: { COMPUTE: 4 },
  } as unknown as typeof globalThis;
  const capabilityEnvironment = browserCapabilityEnvironment(scope);
  capabilityEnvironment.warmupProfile = { id: 'tiny', revision: 'v1', checksum: `sha256-${'c'.repeat(64)}`, assetBytes: 8, peakBytes: 8, largestBufferBytes: 8, providers: ['webgpu'] };
  const result = await detectSemanticRuntimeCapabilities(capabilityEnvironment);
  assert.equal(result.webgpu.state, 'unavailable');
  assert.match(result.limitations.join(' '), /allocation rejected/i);
});

test('cancelling a hung WebGPU submission destroys allocated buffers and the device', async () => {
  let bufferDestroyed = false; let deviceDestroyed = false; let submitted!: () => void;
  const submissionStarted = new Promise<void>(resolve => { submitted = resolve; });
  const scope = {
    navigator: { gpu: { requestAdapter: async () => ({
      limits: { maxBufferSize: 1024, maxStorageBufferBindingSize: 1024 },
      requestDevice: async () => ({
        pushErrorScope: () => {}, popErrorScope: async () => null,
        createBuffer: ({ size }: { size: number }) => ({ getMappedRange: () => new ArrayBuffer(size), unmap: () => {}, destroy: () => { bufferDestroyed = true; } }),
        createBindGroupLayout: () => ({}), createBindGroup: () => ({}), createCommandEncoder: () => ({ clearBuffer: () => {}, finish: () => ({}) }),
        queue: { submit: () => {}, onSubmittedWorkDone: () => { submitted(); return new Promise<void>(() => {}); } }, destroy: () => { deviceDestroyed = true; },
      }),
    }) } },
    WebAssembly, Worker: class {}, SharedArrayBuffer, Atomics, crossOriginIsolated: true,
    OffscreenCanvas: class {}, createImageBitmap: () => {}, AudioContext: class {}, caches: {}, indexedDB: {},
    GPUBufferUsage: { STORAGE: 128, COPY_DST: 8 }, GPUShaderStage: { COMPUTE: 4 },
  } as unknown as typeof globalThis;
  const capabilityEnvironment = browserCapabilityEnvironment(scope);
  capabilityEnvironment.warmupProfile = { id: 'tiny', revision: 'v1', checksum: `sha256-${'c'.repeat(64)}`, assetBytes: 8, peakBytes: 8, largestBufferBytes: 8, providers: ['webgpu'] };
  const controller = new AbortController();
  const pending = detectSemanticRuntimeCapabilities(capabilityEnvironment, { signal: controller.signal });
  await submissionStarted; controller.abort();
  await assert.rejects(pending, error => error instanceof DOMException && error.name === 'AbortError');
  assert.equal(bufferDestroyed, true); assert.equal(deviceDestroyed, true);
});

test('timing out a hung WebGPU submission destroys allocated buffers and the device', async () => {
  let bufferDestroyed = false; let deviceDestroyed = false;
  const scope = {
    navigator: { gpu: { requestAdapter: async () => ({
      limits: { maxBufferSize: 1024, maxStorageBufferBindingSize: 1024 },
      requestDevice: async () => ({
        pushErrorScope: () => {}, popErrorScope: async () => null,
        createBuffer: ({ size }: { size: number }) => ({ getMappedRange: () => new ArrayBuffer(size), unmap: () => {}, destroy: () => { bufferDestroyed = true; } }),
        createBindGroupLayout: () => ({}), createBindGroup: () => ({}), createCommandEncoder: () => ({ clearBuffer: () => {}, finish: () => ({}) }),
        queue: { submit: () => {}, onSubmittedWorkDone: () => new Promise<void>(() => {}) }, destroy: () => { deviceDestroyed = true; },
      }),
    }) } },
    WebAssembly, Worker: class {}, SharedArrayBuffer, Atomics, crossOriginIsolated: true,
    OffscreenCanvas: class {}, createImageBitmap: () => {}, AudioContext: class {}, caches: {}, indexedDB: {},
    GPUBufferUsage: { STORAGE: 128, COPY_DST: 8 }, GPUShaderStage: { COMPUTE: 4 },
  } as unknown as typeof globalThis;
  const capabilityEnvironment = browserCapabilityEnvironment(scope);
  capabilityEnvironment.warmupProfile = { id: 'tiny', revision: 'v1', checksum: `sha256-${'c'.repeat(64)}`, assetBytes: 8, peakBytes: 8, largestBufferBytes: 8, providers: ['webgpu'] };
  const result = await detectSemanticRuntimeCapabilities(capabilityEnvironment, { probeTimeoutMs: 5 });
  assert.equal(result.webgpu.state, 'unavailable');
  assert.match(result.limitations.join(' '), /timed out/i);
  assert.equal(bufferDestroyed, true); assert.equal(deviceDestroyed, true);
});
