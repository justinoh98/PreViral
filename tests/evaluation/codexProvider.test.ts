import test from 'node:test';
import assert from 'node:assert/strict';
import { codexArguments } from '../../evaluation/codexProvider';
test('local Codex review uses attached images, a strict schema, no shell and ephemeral read-only execution', () => {
  const args = codexArguments('C:/temporary/review', 'test-model', ['C:/temporary/review/first.jpg', 'C:/temporary/review/last.jpg']);
  assert.ok(args.includes('--ephemeral')); assert.ok(args.includes('--ignore-user-config')); assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(args.filter(a => a === '--image').length, 2); assert.ok(args.includes('--output-schema')); assert.equal(args.at(-1), '-');
  for (const feature of ['shell_tool', 'unified_exec', 'apps', 'plugins', 'hooks', 'multi_agent']) assert.equal(args[args.indexOf(feature) - 1], '--disable');
});
