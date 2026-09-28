import type { CapabilityTier } from '../../../evaluation/contracts';
import type { SemanticRuntimeCapabilities } from './runtimeCapabilities';

export type SemanticWorkerStatus = 'idle' | 'initializing' | 'ready' | 'running' | 'cancelled' | 'partial' | 'failed' | 'cleaned';
export type SemanticWorkerCommand =
  | { type: 'initialize'; requestId: string }
  | { type: 'cancel'; requestId: string }
  | { type: 'cleanup'; requestId: string };
export type SemanticWorkerEvent =
  | { type: 'state'; requestId: string; status: SemanticWorkerStatus }
  | { type: 'progress'; requestId: string; stage: 'capability_probe' | 'cleanup'; completed: number; total: number }
  | { type: 'capabilities'; requestId: string; capabilities: SemanticRuntimeCapabilities }
  | { type: 'capability_downgrade'; requestId: string; from: CapabilityTier; to: CapabilityTier; reason: string }
  | { type: 'error'; requestId: string; code: 'model_load_failed' | 'worker_failed' | 'cleanup_failed' | 'duplicate_request'; message: string; recoverable: boolean };
