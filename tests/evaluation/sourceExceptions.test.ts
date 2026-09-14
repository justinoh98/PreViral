import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreObservations } from '../../evaluation/scoring';
import { STRICT_SOURCE_EXCEPTIONS } from '../../evaluation/sourceRules';
import { observations } from '../fixtures/evaluatorCases';

const expectation = (id: string) => STRICT_SOURCE_EXCEPTIONS.find(fixture => fixture.id === id)!;

for (const fixture of [
  ['compelling-static-opening', 'A motionless opening has immediate visual intrigue and a clear reason to continue.'],
  ['deliberate-silence', 'The deliberate silent opening supports tension; measured silence is not treated as dead time.'],
  ['single-shot-meaningful-progression', 'One continuous shot develops through visible lighting and reflection changes.'],
  ['no-text-clarity', 'The subject and action communicate clearly without any on-screen text.'],
  ['long-shot-with-continued-value', 'The held shot continues to reveal visual information and sustain anticipation.'],
  ['non-loop-intentional-ending', 'The ending resolves the action intentionally without returning to the opening frame.'],
  ['slow-but-escalating-payoff', 'The setup steadily increases tension before delivering the supported payoff.'],
  ['visually-similar-semantically-useful', 'Similar compositions provide a useful before-and-after comparison.'],
] as const) {
  test(`${fixture[0]} does not create a mechanical scoring penalty`, () => {
    const o = observations('strong');
    o.traits.pacing.reason = fixture[1];
    o.traits.firstFrame.reason = fixture[1];
    o.traits.ending.reason = fixture[1];
    if (fixture[0] === 'no-text-clarity') o.traits.textLegibility.level = 'not_applicable';
    const score = scoreObservations(o);
    assert.ok(expectation(fixture[0]));
    assert.equal(score.overallStars, 4);
    assert.equal(score.aspectScores.hookStrength, 4);
  });
}

test('rapid-cutting-without-meaningful-progression remains a weakness despite high measured change', () => {
  const o = observations('strong');
  o.traits.progression.level = 'ineffective';
  o.traits.pacing.level = 'weak';
  o.traits.progression.reason = 'Rapid cuts repeat the same information without meaningful development.';
  o.traits.pacing.reason = 'High measured visual change does not add viewer value.';
  assert.ok(expectation('rapid-cutting-without-meaningful-progression'));
  assert.ok(scoreObservations(o).aspectScores.pacingAndStimulation < 3);
});
