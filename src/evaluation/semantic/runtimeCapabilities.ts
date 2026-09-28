import type { CapabilityTier } from '../../../evaluation/contracts';

export type ProbeState = 'available' | 'unavailable' | 'unknown';
export type CandidateWarmupProfile = { id: string; revision: string; checksum: string; assetBytes: number; peakBytes: number; largestBufferBytes: number; providers: Array<'webgpu' | 'wasm'> };
export type CandidateWarmupResult = { id: string; revision: string; checksum: string; allocatedBytes: number };
export type CapabilityEnvironment = {
  worker: boolean;
  wasm: boolean;
  wasmSimd: boolean;
  wasmThreads: boolean;
  crossOriginIsolated: boolean;
  offscreenCanvas: boolean;
  imageBitmap: boolean;
  audioContext: boolean;
  cacheStorage: boolean;
  indexedDb: boolean;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  warmupProfile: CandidateWarmupProfile | null;
  storageEstimate?: (signal?: AbortSignal) => Promise<{ quota?: number; usage?: number }>;
  requestWebGpuAdapter?: (signal?: AbortSignal) => Promise<{ maxBufferSize: number | null; maxStorageBufferBindingSize: number | null } | null>;
  webGpuWarmup?: (profile: CandidateWarmupProfile | null, signal?: AbortSignal) => Promise<CandidateWarmupResult | null>;
  wasmWarmup?: (profile: CandidateWarmupProfile | null, signal?: AbortSignal) => Promise<CandidateWarmupResult | null>;
};

export type SemanticRuntimeCapabilities = {
  version: 'semantic-runtime-capabilities-v1';
  tier: CapabilityTier;
  webgpu: { state: ProbeState; maxBufferSize: number | null; maxStorageBufferBindingSize: number | null };
  wasm: { state: ProbeState; simd: boolean; threads: boolean };
  worker: { state: ProbeState };
  browserFeatures: { offscreenCanvas: boolean; imageBitmap: boolean; audioContext: boolean; crossOriginIsolated: boolean };
  storage: { state: ProbeState; cacheStorage: boolean; indexedDb: boolean; quotaBytes: number | null; availableBytes: number | null };
  memory: { deviceMemoryGb: number | null; hardwareConcurrency: number | null; constrained: boolean };
  warmupProfile: CapabilityEnvironment['warmupProfile'];
  downgradeReasons: string[];
  limitations: string[];
};

const simdProbe = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]);

export function browserCapabilityEnvironment(scope: typeof globalThis = globalThis): CapabilityEnvironment {
  type BufferLike = { getMappedRange(): ArrayBuffer; unmap(): void; destroy(): void };
  const navigatorLike = (scope.navigator ?? {}) as Navigator & { deviceMemory?: number; gpu?: { requestAdapter(): Promise<{ limits?: { maxBufferSize?: number; maxStorageBufferBindingSize?: number }; requestDevice(options?: { requiredLimits: { maxBufferSize: number; maxStorageBufferBindingSize: number } }): Promise<{ pushErrorScope(filter: 'validation' | 'out-of-memory'): void; popErrorScope(): Promise<{ message?: string } | null>; createBuffer(options: { size: number; usage: number; mappedAtCreation?: boolean }): BufferLike; createBindGroupLayout(options: object): object; createBindGroup(options: object): object; createCommandEncoder(): { clearBuffer(buffer: BufferLike, offset: number, size: number): void; finish(): object }; queue: { submit(commands: object[]): void; onSubmittedWorkDone(): Promise<void> }; destroy?(): void }> } | null> }; storage?: { estimate(): Promise<{ quota?: number; usage?: number }> } };
  const wasm = typeof scope.WebAssembly !== 'undefined';
  return {
    worker: typeof scope.Worker !== 'undefined', wasm, warmupProfile: null,
    wasmSimd: wasm && WebAssembly.validate(simdProbe),
    wasmThreads: wasm && typeof scope.SharedArrayBuffer !== 'undefined' && typeof scope.Atomics !== 'undefined' && scope.crossOriginIsolated === true,
    crossOriginIsolated: scope.crossOriginIsolated === true,
    offscreenCanvas: typeof scope.OffscreenCanvas !== 'undefined', imageBitmap: typeof scope.createImageBitmap === 'function',
    audioContext: 'AudioContext' in scope || 'webkitAudioContext' in scope,
    cacheStorage: 'caches' in scope, indexedDb: 'indexedDB' in scope,
    hardwareConcurrency: Number.isFinite(navigatorLike.hardwareConcurrency) ? navigatorLike.hardwareConcurrency : null,
    deviceMemoryGb: Number.isFinite(navigatorLike.deviceMemory) ? navigatorLike.deviceMemory! : null,
    storageEstimate: navigatorLike.storage?.estimate ? () => navigatorLike.storage!.estimate() : undefined,
    requestWebGpuAdapter: navigatorLike.gpu?.requestAdapter ? async () => {
      const adapter = await navigatorLike.gpu!.requestAdapter();
      if (!adapter) return null;
      return { maxBufferSize: adapter.limits?.maxBufferSize ?? null, maxStorageBufferBindingSize: adapter.limits?.maxStorageBufferBindingSize ?? null };
    } : undefined,
    webGpuWarmup: navigatorLike.gpu?.requestAdapter ? async (profile, signal) => {
      const awaitWithAbort = async <T>(promise: Promise<T>): Promise<T> => {
        if (!signal) return promise;
        if (signal.aborted) throw abortError();
        let onAbort!: () => void;
        const cancelled = new Promise<never>((_resolve, reject) => { onAbort = () => reject(abortError()); signal.addEventListener('abort', onAbort, { once: true }); });
        try { return await Promise.race([promise, cancelled]); } finally { signal.removeEventListener('abort', onAbort); }
      };
      if (signal?.aborted) throw abortError();
      const adapter = await awaitWithAbort(navigatorLike.gpu!.requestAdapter());
      if (signal?.aborted) throw abortError();
      if (!adapter) return null;
      const largestBufferBytes = profile?.largestBufferBytes ?? 1024 * 1024;
      if ((adapter.limits?.maxBufferSize ?? 0) < largestBufferBytes || (adapter.limits?.maxStorageBufferBindingSize ?? 0) < largestBufferBytes) return null;
      const devicePromise = adapter.requestDevice({ requiredLimits: { maxBufferSize: largestBufferBytes, maxStorageBufferBindingSize: largestBufferBytes } });
      let device: Awaited<typeof devicePromise>;
      try { device = await awaitWithAbort(devicePromise); }
      catch (error) { if (isAbortError(error)) void devicePromise.then(lateDevice => lateDevice.destroy?.(), () => {}); throw error; }
      if (signal?.aborted) { device.destroy?.(); throw abortError(); }
      const gpuConstants = scope as typeof globalThis & { GPUBufferUsage?: { STORAGE?: number; COPY_DST?: number }; GPUShaderStage?: { COMPUTE?: number } };
      const usage = (gpuConstants.GPUBufferUsage?.STORAGE ?? 128) | (gpuConstants.GPUBufferUsage?.COPY_DST ?? 8);
      const requestedBytes = profile?.peakBytes ?? largestBufferBytes;
      const buffers: BufferLike[] = [];
      device.pushErrorScope('validation'); device.pushErrorScope('out-of-memory');
      try {
        let allocatedBytes = 0;
        while (allocatedBytes < requestedBytes) {
          if (signal?.aborted) throw abortError();
          const size = Math.ceil(Math.min(largestBufferBytes, requestedBytes - allocatedBytes) / 4) * 4;
          const buffer = device.createBuffer({ size, usage, mappedAtCreation: true });
          const mapped = new Uint8Array(buffer.getMappedRange());
          if (mapped.length) { mapped[0] = 1; mapped[mapped.length - 1] = 1; }
          buffer.unmap(); buffers.push(buffer); allocatedBytes += size;
        }
        const bindingSize = Math.min(largestBufferBytes, requestedBytes);
        const layout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: gpuConstants.GPUShaderStage?.COMPUTE ?? 4, buffer: { type: 'storage', minBindingSize: bindingSize } }] });
        device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: buffers[0], offset: 0, size: bindingSize } }] });
        const encoder = device.createCommandEncoder(); encoder.clearBuffer(buffers[0], 0, Math.min(4, bindingSize)); device.queue.submit([encoder.finish()]);
        await awaitWithAbort(device.queue.onSubmittedWorkDone());
        if (signal?.aborted) throw abortError();
        const outOfMemory = await awaitWithAbort(device.popErrorScope()); const validation = await awaitWithAbort(device.popErrorScope());
        if (signal?.aborted) throw abortError();
        if (outOfMemory || validation) throw new Error(outOfMemory?.message || validation?.message || 'WebGPU allocation validation failed.');
        return { id: profile?.id ?? 'generic-webgpu-probe', revision: profile?.revision ?? 'v1', checksum: profile?.checksum ?? `sha256-${'0'.repeat(64)}`, allocatedBytes };
      } finally { for (const buffer of buffers) buffer.destroy(); device.destroy?.(); }
    } : undefined,
    wasmWarmup: wasm ? async profile => {
      const allocatedBytes = profile?.peakBytes ?? 65_536;
      const pages = Math.ceil(allocatedBytes / 65_536);
      const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
      return memory.buffer.byteLength >= allocatedBytes ? { id: profile?.id ?? 'generic-wasm-probe', revision: profile?.revision ?? 'v1', checksum: profile?.checksum ?? `sha256-${'0'.repeat(64)}`, allocatedBytes: memory.buffer.byteLength } : null;
    } : undefined,
  };
}

const abortError = () => new DOMException('Aborted', 'AbortError');
const isAbortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';
async function boundedProbe<T>(probe: (signal: AbortSignal) => Promise<T>, signal: AbortSignal | undefined, timeoutMs: number): Promise<T> {
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  let timedOut = false;
  try {
    const timeoutPromise = new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => { timedOut = true; reject(new Error('probe timed out')); controller.abort(); }, timeoutMs); });
    const abortPromise = new Promise<never>((_resolve, reject) => {
      if (!signal) return;
      onAbort = () => { reject(abortError()); controller.abort(); }; signal.addEventListener('abort', onAbort, { once: true });
    });
    const result = await Promise.race([probe(controller.signal), timeoutPromise, abortPromise]);
    if (signal?.aborted) throw abortError();
    return result;
  } catch (error) {
    if (timedOut) throw new Error('probe timed out');
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
  }
}

export async function detectSemanticRuntimeCapabilities(environment = browserCapabilityEnvironment(), options: { signal?: AbortSignal; probeTimeoutMs?: number } = {}): Promise<SemanticRuntimeCapabilities> {
  const timeoutMs = options.probeTimeoutMs ?? 5_000;
  const limitations: string[] = [];
  const downgradeReasons: string[] = [];
  const verifiedProviders = new Set<'webgpu' | 'wasm'>();
  const profile = environment.warmupProfile;
  const verifiedWarmup = (result: CandidateWarmupResult | null, provider: 'webgpu' | 'wasm') => {
    if (!result) return false;
    if (!profile) return true;
    const matches = profile.providers.includes(provider) && result.id === profile.id && result.revision === profile.revision && result.checksum === profile.checksum && result.allocatedBytes >= profile.peakBytes;
    if (matches) verifiedProviders.add(provider);
    return matches;
  };
  let webgpu: SemanticRuntimeCapabilities['webgpu'] = { state: 'unavailable', maxBufferSize: null, maxStorageBufferBindingSize: null };
  if (environment.requestWebGpuAdapter) {
    try {
      const adapter = await boundedProbe(probeSignal => environment.requestWebGpuAdapter!(probeSignal), options.signal, timeoutMs);
      if (adapter) webgpu = { state: 'available', ...adapter };
      else limitations.push('WebGPU is exposed but no usable adapter was returned.');
    } catch (error) { if (isAbortError(error)) throw error; limitations.push(`WebGPU adapter probe failed: ${error instanceof Error ? error.message : 'unknown error'}.`); }
  }
  if (webgpu.state === 'available') {
    const exceedsLimits = profile && (webgpu.maxBufferSize === null || webgpu.maxStorageBufferBindingSize === null || webgpu.maxBufferSize < profile.largestBufferBytes || webgpu.maxStorageBufferBindingSize < profile.largestBufferBytes);
    if (exceedsLimits) {
      webgpu = { state: 'unavailable', maxBufferSize: null, maxStorageBufferBindingSize: null };
      limitations.push('WebGPU buffer limits do not support the requested candidate allocation plan.');
    }
  }
  if (webgpu.state === 'available') {
    try {
      const result = environment.webGpuWarmup ? await boundedProbe(probeSignal => environment.webGpuWarmup!(profile, probeSignal), options.signal, timeoutMs) : null;
      if (!verifiedWarmup(result, 'webgpu')) { webgpu = { state: 'unavailable', maxBufferSize: null, maxStorageBufferBindingSize: null }; limitations.push('WebGPU allocation warm-up did not complete for the requested candidate profile.'); }
    } catch (error) { if (isAbortError(error)) throw error; webgpu = { state: 'unavailable', maxBufferSize: null, maxStorageBufferBindingSize: null }; limitations.push(`WebGPU allocation warm-up failed: ${error instanceof Error ? error.message : 'unknown error'}.`); }
  }
  let wasmReady = false;
  if (environment.wasm) {
    try {
      const result = environment.wasmWarmup ? await boundedProbe(probeSignal => environment.wasmWarmup!(profile, probeSignal), options.signal, timeoutMs) : null;
      wasmReady = verifiedWarmup(result, 'wasm');
    }
    catch (error) { if (isAbortError(error)) throw error; limitations.push(`WASM allocation warm-up failed: ${error instanceof Error ? error.message : 'unknown error'}.`); }
    if (!wasmReady) limitations.push('WASM allocation warm-up did not complete.');
  }
  let storageState: ProbeState = environment.cacheStorage || environment.indexedDb ? 'available' : 'unavailable';
  let quotaBytes: number | null = null; let availableBytes: number | null = null;
  if (environment.storageEstimate) {
    try {
      const estimate = await boundedProbe(probeSignal => environment.storageEstimate!(probeSignal), options.signal, timeoutMs);
      quotaBytes = Number.isFinite(estimate.quota) ? estimate.quota! : null;
      availableBytes = quotaBytes !== null && Number.isFinite(estimate.usage) ? Math.max(0, quotaBytes - estimate.usage!) : null;
    } catch (error) { if (isAbortError(error)) throw error; storageState = 'unknown'; limitations.push(`Storage quota probe failed: ${error instanceof Error ? error.message : 'unknown error'}.`); }
  }
  const constrained = (environment.deviceMemoryGb !== null && environment.deviceMemoryGb < 4) || (environment.hardwareConcurrency !== null && environment.hardwareConcurrency < 4);
  if (webgpu.state !== 'available') downgradeReasons.push('A usable WebGPU adapter is unavailable.');
  if (!environment.worker) downgradeReasons.push('Web Worker execution is unavailable.');
  if (!wasmReady) downgradeReasons.push('A usable WebAssembly runtime is unavailable.');
  if (constrained) downgradeReasons.push('Observable memory or CPU capacity is constrained.');
  if (!environment.wasmSimd) limitations.push('WASM SIMD is unavailable.');
  if (!environment.wasmThreads) limitations.push('WASM threads are unavailable; cross-origin isolation may be required.');
  if (!profile) downgradeReasons.push('No candidate-specific model allocation warm-up has qualified this device.');
  let tier: CapabilityTier = 'low';
  if (environment.worker && wasmReady && webgpu.state === 'available' && !constrained && profile && verifiedProviders.has('webgpu') && profile.peakBytes >= 512 * 1024 * 1024) tier = 'high';
  else if (environment.worker && wasmReady && environment.wasmSimd && !constrained && profile && verifiedProviders.has('wasm') && profile.peakBytes >= 128 * 1024 * 1024) tier = 'medium';
  return {
    version: 'semantic-runtime-capabilities-v1', tier, webgpu,
    wasm: { state: wasmReady ? 'available' : 'unavailable', simd: environment.wasmSimd, threads: environment.wasmThreads },
    worker: { state: environment.worker ? 'available' : 'unavailable' },
    browserFeatures: { offscreenCanvas: environment.offscreenCanvas, imageBitmap: environment.imageBitmap, audioContext: environment.audioContext, crossOriginIsolated: environment.crossOriginIsolated },
    storage: { state: storageState, cacheStorage: environment.cacheStorage, indexedDb: environment.indexedDb, quotaBytes, availableBytes },
    memory: { deviceMemoryGb: environment.deviceMemoryGb, hardwareConcurrency: environment.hardwareConcurrency, constrained },
    warmupProfile: profile && verifiedProviders.size ? { ...profile, providers: profile.providers.filter(provider => verifiedProviders.has(provider)) } : null,
    downgradeReasons, limitations,
  };
}
