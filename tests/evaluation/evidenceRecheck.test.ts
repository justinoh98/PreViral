import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInventory } from '../../evaluation/grounding';
import { validateQuotedText, explain } from '../../evaluation/feedback';
import { interpret } from '../../evaluation/interpret';
import { scoreObservations } from '../../evaluation/scoring';
import { inventory, interpretation, verification } from '../fixtures/groundingCases';
import { request, feedback, observations } from '../fixtures/evaluatorCases';
import { groundingReport } from '../../evaluation/grounding';

test('unreadable text cannot become a guessed quote; actions cannot cite another shot', () => {
  const i = inventory();
  i.visibleText = [{ sceneId: 'opening', frameIds: ['frame-1'], state: 'unclear', wording: 'Guessed words' }];
  assert.throws(() => validateInventory(i, request().evidence, ''));
  i.visibleText[0].wording = null;
  assert.ok(validateInventory(i, request().evidence, ''));
  i.observedActions = [{ sceneId: 'ending', frameIds: ['frame-1'], description: 'A hand places the lamp.' }];
  assert.throws(() => validateInventory(i, request().evidence, ''));
});
test('replacement wording preserves the actual spelling and affected shot', () => {
  const i = inventory(); i.visibleText = [{ sceneId: 'opening', frameIds: ['frame-1'], state: 'legible', wording: 'A minature street' }];
  const f = feedback(); f.edits = [{ copyBefore: 'minature', copyKind: 'overlay', targetSceneId: 'opening' } as any];
  assert.doesNotThrow(() => validateQuotedText(f, i, ''));
  f.edits[0].copyBefore = 'miniature'; assert.throws(() => validateQuotedText(f, i, ''));
  f.edits[0].copyBefore = 'minature'; f.edits[0].targetSceneId = 'ending'; assert.throws(() => validateQuotedText(f, i, ''));
  f.edits[0].copyKind = 'caption'; assert.doesNotThrow(() => validateQuotedText(f, i, 'A minature street'));
});
test('interpretation and both feedback passes receive original chronological images', async () => {
  const r = request(); const i = inventory(); const g = groundingReport(i, verification(), r.niche, 1);
  const assertImages = (content: any[]) => assert.deepEqual(content.filter(p => p.type === 'input_image').map(p => p.image_url), r.evidence.frames.map(f => f.imageUrl));
  await interpret('test', 'test', i, r.evidence, r.niche, '', g, 'en', async (_k,_m,_p,c) => { assertImages(c); return interpretation(); });
  const o = observations(); let checked = 0;
  await explain('test', 'test', o, scoreObservations(o), r, { grounding: g, aspectContext: interpretation().aspectContext }, async (_k,_m,_p,c,_s,name) => {
    assertImages(c); checked++;
    return name === 'previral_edit_plan' ? feedback() : { supported: true, specific: true, executable: true, copyComplete: true, issues: [] };
  });
  assert.equal(checked, 2);
});
