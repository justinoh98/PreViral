import {
  classifyRealDeviceResult,
  detectSoftwareAdapter,
  selectSmolVlmDtype,
  type RealDeviceRunSummary,
  type SmolVlmDtype,
} from '../../evaluation/realDeviceFeasibility';

type AdapterInfo = Record<string, unknown>;
type GpuDeviceLike = { features: Iterable<string>; limits: object; destroy: () => void };
type GpuAdapterLike = {
  features: Iterable<string>;
  limits: object;
  info?: AdapterInfo;
  isFallbackAdapter?: boolean;
  requestDevice: () => Promise<GpuDeviceLike>;
};
type GpuNavigator = Navigator & { gpu?: { requestAdapter: (options?: { powerPreference?: string; forceFallbackAdapter?: boolean }) => Promise<GpuAdapterLike | null> } };
type MemoryMetrics = { beforeBytes: number | null; peakBytes: number | null; afterBytes: number | null; peakDeltaBytes: number | null };
type LoadResult = { dtype: SmolVlmDtype; artifact: { id: string; revision: string; approximateTotalBytes: number }; loadMs: number; memory: MemoryMetrics; runtimeAdapter: { info: AdapterInfo; isFallbackAdapter?: boolean } };
type InferenceResult = { run: number; dtype: SmolVlmDtype; inferenceMs: number; output: string; memory: MemoryMetrics };
type WorkerReply = { type: 'progress'; detail: unknown } | { type: 'manual-result'; requestId: number; result: unknown } | { type: 'manual-error'; requestId: number; error: string };

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const loadButton = element<HTMLButtonElement>('load');
const inferButton = element<HTMLButtonElement>('infer');
const cancelButton = element<HTMLButtonElement>('cancel');
const eligibilityElement = element<HTMLDivElement>('eligibility');
const progressElement = element<HTMLParagraphElement>('progress');

const summary: RealDeviceRunSummary = {
  hardwareEligible: false,
  loadMs: null,
  inferenceMs: [],
  outputs: [],
  peakMemoryDeltaBytes: null,
  maxMainThreadGapMs: null,
  error: null,
};
let selectedDtype: SmolVlmDtype = 'q4';
let loadedArtifact: LoadResult['artifact'] | null = null;
let worker: Worker | null = null;
let requestId = 0;
let operationRunning = false;
let cancelled = false;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: number }>();

const formatMs = (value: number | null) => value === null ? '—' : `${(value / 1_000).toFixed(3)} s`;
const formatBytes = (value: number | null) => value === null ? 'Unavailable in this browser' : `${(value / (1024 ** 2)).toFixed(1)} MiB detected JS-heap delta (GPU/native memory is not exposed)`;
const stringify = (value: unknown) => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);

function serializableRecord(source: object, preferredKeys: string[]): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  const candidate = source as Record<string, unknown>;
  const prototypeKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(source) ?? {}).filter(key => key !== 'constructor');
  for (const key of new Set([...preferredKeys, ...Object.keys(source), ...prototypeKeys])) {
    try {
      const value = candidate[key];
      if (['string', 'number', 'boolean', 'bigint'].includes(typeof value)) record[key] = value;
    } catch {}
  }
  return record;
}

function setBusy(busy: boolean) {
  operationRunning = busy;
  cancelButton.disabled = !busy;
  loadButton.disabled = busy || !summary.hardwareEligible;
  inferButton.disabled = busy || !summary.hardwareEligible || !loadedArtifact || summary.inferenceMs.length >= 2;
}

function recordMemory(memory: MemoryMetrics) {
  if (memory.peakDeltaBytes !== null) summary.peakMemoryDeltaBytes = Math.max(summary.peakMemoryDeltaBytes ?? 0, memory.peakDeltaBytes);
}

function renderReport() {
  element('model-load').textContent = summary.loadMs === null
    ? '—'
    : `${formatMs(summary.loadMs)} — ${loadedArtifact?.id}@${loadedArtifact?.revision} (${selectedDtype})`;
  element('first-inference').textContent = formatMs(summary.inferenceMs[0] ?? null);
  element('second-inference').textContent = formatMs(summary.inferenceMs[1] ?? null);
  const totalMs = summary.loadMs === null ? null : summary.loadMs + summary.inferenceMs.reduce((sum, value) => sum + value, 0);
  const responsiveness = summary.maxMainThreadGapMs === null ? 'responsiveness unavailable' : `max main-thread gap ${summary.maxMainThreadGapMs.toFixed(1)} ms`;
  element('total').textContent = totalMs === null ? '—' : `${formatMs(totalMs)}; ${responsiveness}`;
  element('memory').textContent = formatBytes(summary.peakMemoryDeltaBytes);
  element('output').textContent = summary.outputs.length ? summary.outputs.map((output, index) => `RUN ${index + 1}: ${output}`).join('\n') : '—';
  element('error').textContent = summary.error ?? '—';

  let decision: string;
  if (cancelled) decision = 'PENDING — CANCELLED; reload the page to retry';
  else decision = classifyRealDeviceResult(summary) ?? `PENDING — ${summary.inferenceMs.length ? 'run the second/warm inference' : 'load and complete two inference runs'}`;
  element('result').innerHTML = '';
  const strong = document.createElement('strong');
  strong.textContent = decision;
  element('result').append(strong);
}

function failWorker(error: Error) {
  for (const request of pending.values()) {
    window.clearTimeout(request.timeout);
    request.reject(error);
  }
  pending.clear();
  worker?.terminate();
  worker = null;
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../phase-3a/smolVlmWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    if (event.data.type === 'progress') {
      const detail = event.data.detail as { stage?: string; status?: string; file?: string };
      progressElement.textContent = [detail.stage, detail.status, detail.file].filter(Boolean).join(' — ') || 'Model operation in progress…';
      return;
    }
    const request = pending.get(event.data.requestId);
    if (!request) return;
    window.clearTimeout(request.timeout);
    pending.delete(event.data.requestId);
    if (event.data.type === 'manual-error') request.reject(new Error(event.data.error));
    else request.resolve(event.data.result);
  };
  worker.onerror = event => failWorker(new Error(event.message || 'Real-device worker failed.'));
  return worker;
}

function callWorker<T>(message: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const id = ++requestId;
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      failWorker(new Error(`Operation exceeded the ${Math.round(timeoutMs / 1_000)} second bound.`));
    }, timeoutMs);
    pending.set(id, { resolve: value => resolve(value as T), reject, timeout });
    ensureWorker().postMessage({ ...message, requestId: id });
  });
}

async function withResponsiveness<T>(operation: () => Promise<T>): Promise<T> {
  let lastTick = performance.now();
  let maxGap = 0;
  const heartbeat = window.setInterval(() => {
    const now = performance.now();
    maxGap = Math.max(maxGap, now - lastTick);
    lastTick = now;
  }, 100);
  try {
    return await operation();
  } finally {
    window.clearInterval(heartbeat);
    maxGap = Math.max(maxGap, performance.now() - lastTick);
    summary.maxMainThreadGapMs = Math.max(summary.maxMainThreadGapMs ?? 0, maxGap);
  }
}

async function detectGpu() {
  element('browser').textContent = navigator.userAgent;
  const gpu = (navigator as GpuNavigator).gpu;
  if (!gpu) {
    element('webgpu').textContent = 'no';
    eligibilityElement.textContent = 'SOFTWARE/FALLBACK GPU — RESULT NOT VALID FOR PERFORMANCE DECISION';
    progressElement.textContent = 'WebGPU is not exposed. Use current Chrome or Edge on a WebGPU-capable computer.';
    renderReport();
    return;
  }
  element('webgpu').textContent = 'yes';
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance', forceFallbackAdapter: false });
    if (!adapter) throw new Error('WebGPU did not return an adapter.');
    const info = serializableRecord(adapter.info ?? {}, ['vendor', 'architecture', 'device', 'description']);
    const features = [...adapter.features].sort();
    const limits = serializableRecord(adapter.limits, ['maxBufferSize', 'maxStorageBufferBindingSize', 'maxComputeWorkgroupStorageSize', 'maxComputeInvocationsPerWorkgroup']);
    const software = detectSoftwareAdapter(info, adapter.isFallbackAdapter);
    const device = await adapter.requestDevice();
    const deviceFeatures = [...device.features].sort();
    const deviceLimits = serializableRecord(device.limits, Object.keys(limits));
    device.destroy();

    selectedDtype = selectSmolVlmDtype(features);
    summary.hardwareEligible = !software;
    element('adapter').textContent = stringify({ ...info, isFallbackAdapter: adapter.isFallbackAdapter ?? 'not exposed', softwareDetected: software });
    element('dtype').textContent = `${selectedDtype} (${features.includes('shader-f16') ? 'shader-f16 available' : 'shader-f16 unavailable; using all-q4'})`;
    element('features').textContent = stringify({ adapter: features, device: deviceFeatures });
    element('limits').textContent = stringify(deviceLimits);
    element('report-features').textContent = stringify(features);
    if (software) {
      eligibilityElement.textContent = 'SOFTWARE/FALLBACK GPU — RESULT NOT VALID FOR PERFORMANCE DECISION';
      progressElement.textContent = 'Inference is disabled because a software/fallback renderer was detected.';
    } else {
      eligibilityElement.textContent = 'HARDWARE TEST ELIGIBLE';
      eligibilityElement.className = 'status eligible';
      progressElement.textContent = 'Ready. Load the pinned SmolVLM2 model.';
    }
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
    eligibilityElement.textContent = 'SOFTWARE/FALLBACK GPU — RESULT NOT VALID FOR PERFORMANCE DECISION';
    progressElement.textContent = 'Hardware eligibility could not be established.';
  }
  setBusy(false);
  renderReport();
}

loadButton.addEventListener('click', async () => {
  setBusy(true);
  cancelled = false;
  summary.error = null;
  summary.loadMs = null;
  summary.inferenceMs = [];
  summary.outputs = [];
  summary.peakMemoryDeltaBytes = null;
  summary.maxMainThreadGapMs = null;
  loadedArtifact = null;
  progressElement.textContent = 'Loading pinned model in the browser worker…';
  renderReport();
  try {
    const result = await withResponsiveness(() => callWorker<LoadResult>({ type: 'manual-load', dtype: selectedDtype }, 300_000));
    summary.loadMs = result.loadMs;
    loadedArtifact = result.artifact;
    recordMemory(result.memory);
    if (detectSoftwareAdapter(result.runtimeAdapter.info, result.runtimeAdapter.isFallbackAdapter)) {
      summary.hardwareEligible = false;
      eligibilityElement.textContent = 'SOFTWARE/FALLBACK GPU — RESULT NOT VALID FOR PERFORMANCE DECISION';
      eligibilityElement.className = 'status invalid';
      progressElement.textContent = 'The model runtime selected a software/fallback adapter. Inference is disabled.';
      loadedArtifact = null;
      await callWorker({ type: 'manual-dispose' }, 30_000);
    } else {
      progressElement.textContent = 'Model loaded. Run the first inference.';
    }
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
    progressElement.textContent = 'Model load failed.';
  } finally {
    setBusy(false);
    renderReport();
  }
});

inferButton.addEventListener('click', async () => {
  setBusy(true);
  summary.error = null;
  progressElement.textContent = `Running ${summary.inferenceMs.length ? 'second/warm' : 'first'} bounded two-frame inference…`;
  renderReport();
  try {
    const result = await withResponsiveness(() => callWorker<InferenceResult>({ type: 'manual-infer' }, 120_000));
    summary.inferenceMs.push(result.inferenceMs);
    summary.outputs.push(result.output);
    recordMemory(result.memory);
    inferButton.textContent = summary.inferenceMs.length === 1 ? '3. RUN SECOND/WARM INFERENCE' : 'TWO RUNS COMPLETE';
    progressElement.textContent = summary.inferenceMs.length === 1 ? 'First run complete. Run the second/warm inference without reloading.' : 'Two runs complete. Copy the result report.';
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
    progressElement.textContent = 'Inference failed.';
  } finally {
    setBusy(false);
    renderReport();
  }
});

cancelButton.addEventListener('click', () => {
  cancelled = true;
  failWorker(new DOMException('The real-device operation was cancelled.', 'AbortError'));
  loadedArtifact = null;
  summary.error = 'Cancelled by user.';
  progressElement.textContent = 'Cancelled. Load the model again to retry.';
  setBusy(false);
  renderReport();
});

element<HTMLButtonElement>('copy').addEventListener('click', async () => {
  const capability = `USER AGENT: ${navigator.userAgent}\nGPU: ${element('adapter').textContent}\nDTYPE: ${element('dtype').textContent}\n`;
  await navigator.clipboard.writeText(`${capability}\n${element('report').innerText}`);
  progressElement.textContent = 'Result report copied to clipboard.';
});

window.addEventListener('beforeunload', () => worker?.terminate());
void detectGpu();
