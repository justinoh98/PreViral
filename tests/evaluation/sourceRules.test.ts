import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_SOURCES,
  RULE_FAMILIES,
  RULE_REGISTRY_VERSION,
  STRICT_SOURCE_EXCEPTIONS,
  type Applicability,
  type EvidenceProvenance,
} from '../../evaluation/sourceRules';

const expectedExceptions = [
  'compelling-static-opening',
  'deliberate-silence',
  'single-shot-meaningful-progression',
  'no-text-clarity',
  'long-shot-with-continued-value',
  'non-loop-intentional-ending',
  'slow-but-escalating-payoff',
  'visually-similar-semantically-useful',
  'rapid-cutting-without-meaningful-progression',
];

test('canonical source registry contains only the three approved PDFs with page provenance', () => {
  assert.equal(RULE_REGISTRY_VERSION, 'source-rules-v1');
  assert.deepEqual(Object.keys(CANONICAL_SOURCES).sort(), ['GENERAL_GUIDELINE', 'LOW_SKIP_CHECKLIST', 'LOW_SKIP_SUMMARY']);
  assert.deepEqual(Object.values(CANONICAL_SOURCES).map(source => source.pageCount), [3, 9, 3]);
  for (const source of Object.values(CANONICAL_SOURCES)) {
    assert.match(source.file, /^docs\/sources\/.+\.pdf$/);
    assert.ok(source.role.length > 20);
  }
  for (const rule of Object.values(RULE_FAMILIES)) {
    assert.ok(rule.sources.length > 0);
    for (const source of rule.sources) {
      assert.ok(CANONICAL_SOURCES[source.document]);
      assert.ok(source.pages.length > 0);
      assert.ok(source.pages.every(page => page >= 1 && page <= CANONICAL_SOURCES[source.document].pageCount));
    }
  }
});

test('rule families expose classification, applicability, confidence, provenance, and scoring boundaries', () => {
  const validApplicability: Applicability[] = ['applicable', 'not_applicable', 'unknown'];
  const validProvenance: EvidenceProvenance[] = ['measured_local', 'ocr_local', 'transcript_local', 'semantic_local', 'semantic_remote', 'user_context'];
  assert.deepEqual(validApplicability, ['applicable', 'not_applicable', 'unknown']);
  assert.equal(new Set(Object.values(RULE_FAMILIES).map(rule => rule.ruleId)).size, Object.keys(RULE_FAMILIES).length);
  for (const rule of Object.values(RULE_FAMILIES)) {
    assert.match(rule.ruleId, /^RULE_[A-Z0-9_]+$/);
    assert.ok(['universal', 'conditional', 'advisory'].includes(rule.classification));
    assert.ok(['medium', 'high'].includes(rule.requiredConfidence));
    assert.ok(rule.requiredEvidence.length > 0);
    assert.ok(rule.applicabilityConditions.length > 0);
    assert.ok(rule.allowedProvenance.every(source => validProvenance.includes(source)));
    assert.notEqual(rule.scoreAffecting && rule.feedbackOnly, true);
  }
});

test('strict-source exception fixtures prohibit mechanical creative penalties', () => {
  assert.deepEqual(STRICT_SOURCE_EXCEPTIONS.map(fixture => fixture.id), expectedExceptions);
  for (const fixture of STRICT_SOURCE_EXCEPTIONS) {
    assert.ok(fixture.evidence.length > 0);
    assert.ok(fixture.expected.length > 0);
    assert.equal(fixture.automaticPenalty, false);
    assert.ok(fixture.ruleFamilies.every(ruleFamily => RULE_FAMILIES[ruleFamily]));
  }
});

test('strict tactics remain conditional or advisory rather than universal', () => {
  for (const key of ['OPENING_VISUAL_STRENGTH', 'OPENING_TEXT_SUPPORT', 'OPENING_AUDIO_SUPPORT', 'PAYOFF_TIMING', 'LOOP_AND_REWATCH'] as const) {
    assert.equal(RULE_FAMILIES[key].classification, 'conditional');
  }
  assert.equal(RULE_FAMILIES.CTA_CONVERSION.classification, 'advisory');
  assert.equal(RULE_FAMILIES.CTA_CONVERSION.feedbackOnly, true);
});
