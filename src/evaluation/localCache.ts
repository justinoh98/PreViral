import { EVALUATION_VERSION_BOUNDARIES, GROUNDING_VERSION } from '../../evaluation/contracts';
import { PROMPT_VERSION } from '../../evaluation/prompts';
import type { TargetNiche } from '../../evaluation/niches';
import type { ReelEvaluation } from '../types';
import { fingerprintBytes } from './videoFingerprint';

export type EvaluationCacheContext = {
  fingerprint: string;
  niche: TargetNiche;
  language: 'en' | 'ko';
  captionInput: string;
  videoConcept: string;
  audioType: string;
};

export function evaluationCacheKey(context: EvaluationCacheContext): string {
  const canonical = JSON.stringify([
    context.fingerprint, context.niche, context.language, context.captionInput,
    context.videoConcept, context.audioType, EVALUATION_VERSION_BOUNDARIES,
    GROUNDING_VERSION, PROMPT_VERSION,
  ]);
  return fingerprintBytes([new TextEncoder().encode(canonical)]);
}

export function stableEvaluationId(cacheKey: string): string {
  return `eval-${cacheKey.replace(/^sha256-/, '').slice(0, 24)}`;
}

const DATABASE = 'previral-local-evaluator';
const STORE = 'evaluations';
const VERSION = 1;

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readCachedEvaluation(key: string): Promise<ReelEvaluation | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result ? structuredClone(request.result as ReelEvaluation) : null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function writeCachedEvaluation(key: string, evaluation: ReelEvaluation): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(structuredClone(evaluation), key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
