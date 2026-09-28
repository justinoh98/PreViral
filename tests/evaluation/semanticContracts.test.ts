import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALIBRATION_VERSION,
  EXTRACTOR_SCHEMA_VERSION,
  INVENTORY_SCHEMA_VERSION,
  RULE_APPLICABILITY_VERSION,
  SEMANTIC_SCHEMA_VERSION,
  EVALUATION_VERSION_BOUNDARIES,
  type SemanticObservation,
} from '../../evaluation/contracts';
import { contextualInventoryId, semanticId } from '../../evaluation/semanticIds';

const fingerprint = 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

test('Phase 3 contract versions are independent cache boundaries', () => {
  assert.equal(SEMANTIC_SCHEMA_VERSION, 'semantic-observations-v1');
  assert.equal(INVENTORY_SCHEMA_VERSION, 'semantic-inventory-v1');
  assert.equal(EXTRACTOR_SCHEMA_VERSION, 'semantic-extractors-v1');
  assert.equal(RULE_APPLICABILITY_VERSION, 'rule-applicability-v1');
  assert.equal(CALIBRATION_VERSION, 'semantic-calibration-v1');
  assert.deepEqual(EVALUATION_VERSION_BOUNDARIES.semantic, {
    schema: SEMANTIC_SCHEMA_VERSION,
    inventory: INVENTORY_SCHEMA_VERSION,
    extractors: EXTRACTOR_SCHEMA_VERSION,
    applicability: RULE_APPLICABILITY_VERSION,
    calibration: CALIBRATION_VERSION,
  });
});

test('semantic IDs are stable, typed, timed, and content-bound', () => {
  assert.equal(semanticId('observation', 1, 0, 3, fingerprint), `SEMANTIC_OBSERVATION_0001_000000_003000_${'a'.repeat(64)}`);
  const otherFingerprint = `sha256-${'b'.repeat(64)}`;
  const samePrefixFingerprint = `sha256-${'a'.repeat(12)}${'b'.repeat(52)}`;
  assert.notEqual(semanticId('observation', 1, 0, 3, fingerprint), semanticId('observation', 1, 0, 3, otherFingerprint));
  assert.notEqual(semanticId('observation', 1, 0, 3, fingerprint), semanticId('observation', 1, 0, 3, samePrefixFingerprint));
  assert.notEqual(semanticId('observation', 1, 0, 3, fingerprint), semanticId('inventory', 1, 0, 3, fingerprint));
  const factualId = semanticId('inventory', 1, 0, 3, fingerprint);
  assert.notEqual(contextualInventoryId(factualId, 'Photography'), contextualInventoryId(factualId, 'Tech & Gadgets'));
});

test('semantic observation contract preserves provenance and uncertainty without score fields', () => {
  const observation: SemanticObservation<{ label: string }> = {
    id: semanticId('observation', 1, 0, 3, fingerprint),
    kind: 'opening_subject', state: 'unknown', value: null,
    evidenceIds: ['OPENING_0001_000000_003000_aaaaaaaaaaaa'], frameIds: ['FRAME_0001_000000_aaaaaaaaaaaa'], shotIds: ['SHOT_0001_000000_003000_aaaaaaaaaaaa'],
    interval: { startSec: 0, endSec: 3 },
    extractor: { id: 'extractor-none', version: 'unavailable-v1', modelId: null, modelRevision: null, runtime: 'none', runtimeRevision: null, executionProvider: 'none', quantization: null },
    provenance: 'semantic_local', confidence: { value: 0, level: 'low', calibrationVersion: CALIBRATION_VERSION },
    uncertaintyReasons: ['No semantic extractor has run.'],
  };
  assert.equal(observation.state, 'unknown');
  assert.doesNotMatch(JSON.stringify(observation), /stars|overallScore|deduction|scoreEffect|cap/i);
});
