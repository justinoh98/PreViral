import { RUBRIC_VERSION, type MediaEvidence } from './contracts';
import { PROMPT_VERSION } from './prompts';

// Bounded memory only. No video files, keys or transient failures are persisted.
export class EvaluationCache<T> {
  private entries = new Map<string, { expires: number; value: T }>();
  constructor(private capacity = 20, private ttl = 30 * 60_000) {}
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.expires < Date.now()) { this.entries.delete(key); return undefined; }
    return structuredClone(entry.value);
  }
  set(key: string, value: T): void {
    if (this.entries.size >= this.capacity) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { expires: Date.now() + this.ttl, value: structuredClone(value) });
  }
}
export function evidenceKey(e: MediaEvidence, model: string): string {
  const input = JSON.stringify([RUBRIC_VERSION, PROMPT_VERSION, model, e.version, e.durationSeconds, e.width, e.height, e.audioStatus, e.audioUnavailableReason, e.samplingMode, e.sourceFingerprint, e.frames.map(frame => [frame.id, frame.timeSec, frame.imageUrl]), e.audioWav ?? '']);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
