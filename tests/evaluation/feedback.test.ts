import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFeedback } from '../../evaluation/validation';
import { observations, feedback } from '../fixtures/evaluatorCases';
import { explain, validateFeedbackReview } from '../../evaluation/feedback';
import { request } from '../fixtures/evaluatorCases';
import { inventory, verification, interpretation } from '../fixtures/groundingCases';
import { groundingReport } from '../../evaluation/grounding';
import { scoreObservations } from '../../evaluation/scoring';

function withEdit() {
  const o = observations(); o.weaknesses.push({ id: 'hook', aspect: 'hookStrength', severity: 'major', problem: 'The wide setup does not explain why the miniature scene is unusual.', sceneIds: ['opening'] });
  const f = feedback(); f.edits.push({ id: 'move-reveal', weaknessId: 'hook', priority: 'must_fix', action: 'MOVE', sceneIds: ['ending', 'opening'], footage: 'existing', targetSceneId: 'opening', sourceSceneIds: ['ending'], destination: { relation: 'before', sceneId: 'opening' }, problem: o.weaknesses[0].problem, editThis: 'Move a cropped preview of the finished photograph before the wide miniature setup.', useThis: 'Use the final close-up with reflections, then return to the lamp placement.', why: 'The unusual scale gives unfamiliar viewers a reason to watch the lighting process.', copyBefore: null, copyKind: 'overlay', copy: 'This street fits on a table.' });
  f.reeditPlan = [{ editId: 'move-reveal', instruction: 'Place a cropped preview of the reflected street photograph first; add “This street fits on a table.” Then return to the setup.' }];
  return { o, f };
}
test('specific existing-footage edit with actual copy and checklist passes', () => { const { o, f } = withEdit(); assert.ok(validateFeedback(f, o)); });
test('invented footage is rejected', () => { const { o, f } = withEdit(); f.edits[0].sceneIds = ['unseen close-up']; assert.throws(() => validateFeedback(f, o)); });
test('missing replacement copy is rejected', () => { const { o, f } = withEdit(); f.edits[0].copy = ''; assert.throws(() => validateFeedback(f, o)); });
test('major weakness must have a solution', () => { const { o, f } = withEdit(); f.edits = []; f.reeditPlan = []; assert.throws(() => validateFeedback(f, o)); });
test('checklist must cover the edit', () => { const { o, f } = withEdit(); f.reeditPlan = []; assert.throws(() => validateFeedback(f, o)); });
test('an excellent Reel does not require filler edits or CTAs', () => { assert.ok(validateFeedback(feedback(), observations('exceptional'))); });
test('feedback cannot override score', () => { assert.throws(() => validateFeedback({ ...feedback(), overallStars: 5 }, observations())); });
test('source and affected footage are validated separately', () => { const { o, f } = withEdit(); f.edits[0].targetSceneId = 'middle'; assert.throws(() => validateFeedback(f, o)); });
test('movement requires a destination and reshoot cannot pretend to reuse existing footage', () => {
  const { o, f } = withEdit(); f.edits[0].destination = null; assert.throws(() => validateFeedback(f, o));
  const next = withEdit(); next.f.edits[0].footage = 'reshoot'; assert.throws(() => validateFeedback(next.f, next.o));
});
test('generic, invented or copy-incomplete advice fails semantic verification in either language', () => {
  for (const issue of ['Make the red boat more dynamic.', '시청자가 관심을 갖도록 이 장면을 개선하세요.', 'The claimed reaction shot is not in the inventory.', 'The proposed title text is missing.']) {
    assert.throws(() => validateFeedbackReview({ supported: true, specific: false, executable: false, copyComplete: true, issues: [issue] }));
  }
});
test('checklist wording is derived from edits, not fresh contradictory prose', () => {
  const { o, f } = withEdit(); f.reeditPlan[0].instruction = 'Delete the finished photograph and every existing lamp placement shot.';
  const validated = validateFeedback(f, o); assert.equal(validated.reeditPlan[0].instruction, [f.edits[0].editThis, f.edits[0].useThis, `“${f.edits[0].copy}”`].join(' '));
});
test('feedback repair receives the previous plan as well as the exact rejected instruction', async () => {
  let drafts = 0; let checks = 0; const i = inventory(); const o = observations();
  const plan = await explain('test', 'model', o, scoreObservations(o), request(), { grounding: groundingReport(i, verification(), 'Toys & Hobbies', 1), aspectContext: interpretation().aspectContext }, async (_k, _m, prompt, content: any[], _schema, name) => {
    if (name === 'previral_edit_plan') {
      drafts++;
      if (drafts === 2) { assert.deepEqual(JSON.parse(content[0].text).previousPlan, feedback()); assert.match(prompt, /Name the affected miniature street shot/); }
      return feedback();
    }
    checks++;
    return { supported: true, specific: checks > 1, executable: true, copyComplete: true, issues: checks === 1 ? ['Name the affected miniature street shot.'] : [] };
  });
  assert.equal(drafts, 2); assert.ok(plan.summary);
});

test('hashtags require exactly five valid distinct entries', () => {
  for (const tags of [[], ['#one'], ['#one','#one','#two','#three','#four'], ['#bad tag','#two','#three','#four','#five']]) {
    const f = feedback(); f.hashtags = tags; assert.throws(() => validateFeedback(f, observations()));
  }
});
test('playbook must reference actual footage', () => {
  const f = feedback(); f.textPlaybook = [{ sceneId: 'invented', stage: 'Opening', direct: 'A tiny street.', curiosity: 'How small is this?', story: 'I lit a miniature street.', guidance: 'Place the title above the miniature street.' }];
  assert.throws(() => validateFeedback(f, observations()));
});
