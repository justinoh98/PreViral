import { browserCapabilityEnvironment, detectSemanticRuntimeCapabilities } from './runtimeCapabilities';
import { createSemanticWorkerHandler } from './semanticWorkerCore';
import type { SemanticWorkerCommand } from './workerProtocol';

const workerScope = globalThis as typeof globalThis & {
  postMessage?: (event: unknown) => void;
  addEventListener?: (type: 'message', listener: (event: MessageEvent<SemanticWorkerCommand>) => void) => void;
};

if (typeof workerScope.postMessage === 'function' && typeof workerScope.addEventListener === 'function' && typeof document === 'undefined') {
  const handle = createSemanticWorkerHandler({
    emit: event => workerScope.postMessage!(event),
    probe: signal => {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return detectSemanticRuntimeCapabilities(browserCapabilityEnvironment(), { signal });
    },
  });
  workerScope.addEventListener('message', event => { void handle(event.data); });
}
