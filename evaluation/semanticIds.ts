const PREFIX = {
  observation: 'SEMANTIC_OBSERVATION',
  inventory: 'SEMANTIC_INVENTORY',
  extractor: 'SEMANTIC_EXTRACTOR',
  applicability: 'RULE_ASSESSMENT',
} as const;

export type SemanticIdKind = keyof typeof PREFIX;

const millis = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Semantic evidence time must be finite and non-negative.');
  return String(Math.round(seconds * 1000)).padStart(6, '0');
};

export function semanticId(kind: SemanticIdKind, index: number, startSec: number, endSec: number, sourceFingerprint: string): string {
  if (!Number.isInteger(index) || index < 1) throw new Error('Semantic evidence index must be a positive integer.');
  if (endSec < startSec) throw new Error('Semantic evidence end time cannot precede its start time.');
  if (!/^sha256-[a-f0-9]{64}$/.test(sourceFingerprint)) throw new Error('A full-content fingerprint is required for semantic IDs.');
  return [PREFIX[kind], String(index).padStart(4, '0'), millis(startSec), millis(endSec), sourceFingerprint.slice(7)].join('_');
}

export function contextualInventoryId(factualInventoryId: string, targetNiche: string): string {
  if (!/^SEMANTIC_INVENTORY_[0-9]{4}_[0-9]{6}_[0-9]{6}_[a-f0-9]{64}$/.test(factualInventoryId)) throw new Error('A valid factual inventory ID is required.');
  const nicheToken = Array.from(new TextEncoder().encode(targetNiche), byte => byte.toString(16).padStart(2, '0')).join('');
  if (!nicheToken) throw new Error('An exact Target Niche is required.');
  return `SEMANTIC_CONTEXT_${factualInventoryId}_${nicheToken}`;
}