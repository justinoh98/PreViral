import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANALYZER_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVALUATION_VERSION_BOUNDARIES,
  type CapabilityReport,
  type EvidenceState,
  type MeasurementProvenance,
} from '../../evaluation/contracts';
import { RULE_REGISTRY_VERSION } from '../../evaluation/sourceRules';
import { evidenceId } from '../../evaluation/evidence';
import { capabilityReport } from '../../evaluation/capabilities';
import { createVideoFingerprint, fingerprintBytes, IncrementalSha256 } from '../../src/evaluation/videoFingerprint';
import { evaluationCacheKey, stableEvaluationId } from '../../src/evaluation/localCache';

const context = {
  fingerprint: 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  niche: 'Photography' as const,
  language: 'en' as const,
  captionInput: 'A puddle reflection',
  videoConcept: 'One continuous shot',
  audioType: 'Original Voiceover & ASMR',
};

test('full-content SHA-256 identity is stable across names and stream chunk boundaries', async () => {
  const bytes = new TextEncoder().encode('PreViral exact video content');
  const direct = fingerprintBytes([bytes]);
  const chunked = new IncrementalSha256().update(bytes.subarray(0, 3)).update(bytes.subarray(3, 17)).update(bytes.subarray(17)).digestHex();
  const renamedA = new Blob([bytes], { type: 'video/mp4' });
  const renamedB = new Blob([bytes], { type: 'video/webm' });

  assert.equal(direct, `sha256-${chunked}`);
  assert.equal(direct, 'sha256-12c80e2275eaafe459eb474ac58af45ef93f1c712066793def0b9eafb60505d6');
  assert.equal(await createVideoFingerprint(renamedA), direct);
  assert.equal(await createVideoFingerprint(renamedB), direct);
});

test('a real byte edit creates a fresh content identity and cache identity', async () => {
  const original = new Blob([new Uint8Array([1, 2, 3, 4])]);
  const edited = new Blob([new Uint8Array([1, 2, 3, 5])]);
  const first = await createVideoFingerprint(original);
  const second = await createVideoFingerprint(edited);
  assert.notEqual(first, second);
  assert.notEqual(evaluationCacheKey({ ...context, fingerprint: first }), evaluationCacheKey({ ...context, fingerprint: second }));
});

test('cache and stable evaluation identity include content, context, and all version boundaries', () => {
  const key = evaluationCacheKey(context);
  assert.equal(evaluationCacheKey({ ...context }), key);
  assert.equal(stableEvaluationId(key), stableEvaluationId(key));
  assert.notEqual(evaluationCacheKey({ ...context, niche: 'Travel & Aesthetic Vlogs' }), key);
  assert.notEqual(evaluationCacheKey({ ...context, captionInput: 'Different optional context' }), key);
  assert.deepEqual(EVALUATION_VERSION_BOUNDARIES, {
    evidenceSchema: EVIDENCE_SCHEMA_VERSION,
    analyzer: ANALYZER_VERSION,
    sourceRules: RULE_REGISTRY_VERSION,
    rubric: 'previral-creative-v1',
  });
});

test('stable evidence IDs are deterministic, typed, and time-derived', () => {
  assert.equal(evidenceId('frame', 1, 0), 'FRAME_0001_000000');
  assert.equal(evidenceId('shot', 2, 1.25, 3.5), 'SHOT_0002_001250_003500');
  assert.equal(evidenceId('audio_silence', 3, 4, 4.75), 'AUDIO_SILENCE_0003_004000_004750');
  assert.notEqual(evidenceId('shot', 2, 1.25, 3.5), evidenceId('shot', 2, 1.3, 3.5));
});

test('capability reporting distinguishes available, unavailable, and experimental extractors', () => {
  const reports: CapabilityReport[] = capabilityReport({ audioDecode: true, ocr: false, localSemantics: false, remoteSemantics: true });
  const states: EvidenceState[] = reports.map(report => report.state);
  const provenance: MeasurementProvenance[] = reports.map(report => report.provenance);
  assert.ok(states.includes('available'));
  assert.ok(states.includes('unavailable'));
  assert.equal(reports.find(report => report.id === 'remote_semantics')?.mode, 'experimental');
  assert.ok(provenance.every(value => ['measured_local', 'ocr_local', 'semantic_local', 'semantic_remote'].includes(value)));
});
