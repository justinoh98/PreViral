import type { SemanticRuntimeCapabilities } from './runtimeCapabilities';
import type { SemanticWorkerCommand, SemanticWorkerEvent } from './workerProtocol';

export class ModelLoadFailure extends Error {
  constructor(message: string, public requestedTier: 'high' | 'medium' = 'high', public fallbackTier: 'medium' | 'low' | null = null) { super(message); }
}

type WorkerDependencies = {
  emit: (event: SemanticWorkerEvent) => void;
  probe: (signal: AbortSignal) => Promise<SemanticRuntimeCapabilities>;
  cleanup?: () => void | Promise<void>;
  cleanupTimeoutMs?: number;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(value => { clearTimeout(timeout); resolve(value); }, error => { clearTimeout(timeout); reject(error); });
  });
}

export function createSemanticWorkerHandler(dependencies: WorkerDependencies): (command: SemanticWorkerCommand) => Promise<void> {
  type ActiveRequest = { controller: AbortController; promise: Promise<void> };
  const active = new Map<string, ActiveRequest>();
  let disposed = false;
  let cleanupPromise: Promise<void> | null = null;
  return async command => {
    if (command.type === 'cancel') {
      const request = active.get(command.requestId);
      if (!request) return;
      request.controller.abort();
      return;
    }
    if (command.type === 'cleanup') {
      disposed = true;
      cleanupPromise ??= (async () => {
        const pending = [...active.values()];
        for (const request of pending) request.controller.abort();
        const timeoutMs = dependencies.cleanupTimeoutMs ?? 5_000;
        let failure: unknown = null;
        try { await withTimeout(Promise.allSettled(pending.map(request => request.promise)), timeoutMs, 'Active semantic work did not stop before cleanup.'); }
        catch (error) { failure = error; }
        try { if (dependencies.cleanup) await withTimeout(Promise.resolve(dependencies.cleanup()), timeoutMs, 'Semantic resource cleanup timed out.'); }
        catch (error) { failure ??= error; }
        if (failure) throw failure;
      })();
      try {
        await cleanupPromise;
        dependencies.emit({ type: 'progress', requestId: command.requestId, stage: 'cleanup', completed: 1, total: 1 });
        dependencies.emit({ type: 'state', requestId: command.requestId, status: 'cleaned' });
      } catch (error) {
        dependencies.emit({ type: 'error', requestId: command.requestId, code: 'cleanup_failed', message: error instanceof Error ? error.message.slice(0, 300) : 'Semantic worker cleanup failed.', recoverable: false });
        dependencies.emit({ type: 'state', requestId: command.requestId, status: 'failed' });
      }
      return;
    }
    if (disposed) {
      dependencies.emit({ type: 'error', requestId: command.requestId, code: 'worker_failed', message: 'The semantic worker has been cleaned up.', recoverable: false });
      dependencies.emit({ type: 'state', requestId: command.requestId, status: 'failed' });
      return;
    }
    if (active.has(command.requestId)) {
      dependencies.emit({ type: 'error', requestId: command.requestId, code: 'duplicate_request', message: 'A semantic worker request with this ID is already active.', recoverable: false });
      return;
    }
    const controller = new AbortController();
    const entry: ActiveRequest = { controller, promise: Promise.resolve() };
    entry.promise = Promise.resolve().then(async () => {
      dependencies.emit({ type: 'state', requestId: command.requestId, status: 'initializing' });
      dependencies.emit({ type: 'progress', requestId: command.requestId, stage: 'capability_probe', completed: 0, total: 1 });
      try {
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const capabilities = await dependencies.probe(controller.signal);
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        dependencies.emit({ type: 'capabilities', requestId: command.requestId, capabilities });
        dependencies.emit({ type: 'progress', requestId: command.requestId, stage: 'capability_probe', completed: 1, total: 1 });
        dependencies.emit({ type: 'state', requestId: command.requestId, status: 'ready' });
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          dependencies.emit({ type: 'state', requestId: command.requestId, status: 'cancelled' });
          return;
        }
        const modelFailure = error instanceof ModelLoadFailure;
        const recoverable = modelFailure && error.fallbackTier !== null;
        dependencies.emit({ type: 'error', requestId: command.requestId, code: modelFailure ? 'model_load_failed' : 'worker_failed', message: error instanceof Error ? error.message.slice(0, 300) : 'Unknown semantic worker failure.', recoverable });
        if (modelFailure && error.fallbackTier) dependencies.emit({ type: 'capability_downgrade', requestId: command.requestId, from: error.requestedTier, to: error.fallbackTier, reason: error.message.slice(0, 300) });
        dependencies.emit({ type: 'state', requestId: command.requestId, status: recoverable ? 'partial' : 'failed' });
      } finally { if (active.get(command.requestId) === entry) active.delete(command.requestId); }
    });
    active.set(command.requestId, entry);
    await entry.promise;
  };
}
