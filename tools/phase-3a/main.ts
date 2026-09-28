type Provider = 'webgpu' | 'wasm';
type Dtype = 'q4f16' | 'q4';
type WorkerResponse = { type: 'result'; result: unknown } | { type: 'error'; error: string } | { type: 'progress'; detail: unknown };

type PendingRun = { worker: Worker; reject: (error: Error) => void };
let pending: PendingRun | null = null;

const start = (provider: Provider, dtype: Dtype = 'q4f16'): Promise<unknown> => {
  if (pending) throw new Error('A Phase 3.3A worker is already running.');
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./smolVlmWorker.ts', import.meta.url), { type: 'module' });
    pending = { worker, reject };
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.type === 'progress') {
        window.dispatchEvent(new CustomEvent('phase3a-progress', { detail: event.data.detail }));
        return;
      }
      pending = null;
      worker.terminate();
      if (event.data.type === 'result') resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    worker.onerror = event => {
      pending = null;
      worker.terminate();
      reject(new Error(event.message || 'Phase 3.3A worker failed.'));
    };
    worker.postMessage({ type: 'run', provider, dtype });
  });
};

const cancel = (): boolean => {
  if (!pending) return false;
  const { worker, reject } = pending;
  pending = null;
  worker.terminate();
  reject(new DOMException('Phase 3.3A worker terminated.', 'AbortError'));
  return true;
};

window.phase3a = { start, cancel };

declare global {
  interface Window {
    phase3a: { start: (provider: Provider, dtype?: Dtype) => Promise<unknown>; cancel: () => boolean };
  }
}

export {};
