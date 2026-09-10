import type { Observations, ScoreResult, EvaluationRequest, GroundedContext } from './contracts';
import { feedbackSchema, validateFeedback, validateShape, object, list, text, EvaluationError } from './validation';
import { FEEDBACK_PROMPT } from './prompts';
import { imageContent } from './grounding';
import { callStructured } from './provider';

export const feedbackReviewSchema = object({
  supported: { type: 'boolean' }, specific: { type: 'boolean' }, executable: { type: 'boolean' }, copyComplete: { type: 'boolean' }, issues: list(text()),
});
export function validateFeedbackReview(raw: unknown): void {
  validateShape(raw, feedbackReviewSchema);
  const review = raw as { supported: boolean; specific: boolean; executable: boolean; copyComplete: boolean; issues: string[] };
  if (!review.supported || !review.specific || !review.executable || !review.copyComplete || review.issues.length) throw new EvaluationError('UNGROUNDED_FEEDBACK', review.issues.join(' ') || 'The advice is not sufficiently supported and executable.');
}
export async function explain(apiKey: string, model: string, observations: Observations, scores: ScoreResult, request: EvaluationRequest, context: GroundedContext, call = callStructured) {
  const data = { language: request.language, targetNiche: request.niche, inventory: context.grounding.inventory, aspectContext: context.aspectContext, observations, immutableScores: scores, untrustedCreatorContext: { concept: request.videoConcept, caption: request.captionInput } };
  let correction = '';
  let previousPlan: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await call(apiKey, model, FEEDBACK_PROMPT + OPERATION_RULES + correction, [{ type: 'input_text', text: JSON.stringify({ ...data, previousPlan }) }, ...imageContent(request.evidence)], feedbackSchema, 'previral_edit_plan');
    previousPlan = raw;
    try {
      const plan = validateFeedback(raw, observations);
      validateQuotedText(plan, context.grounding.inventory, request.captionInput);
      previousPlan = plan;
      const reviewed = await call(apiKey, model, REVIEW_RULES, [{ type: 'input_text', text: JSON.stringify({ ...data, plan }) }, ...imageContent(request.evidence)], feedbackReviewSchema, 'previral_feedback_check');
      validateFeedbackReview(reviewed);
      return plan;
    } catch (error) {
      if (!(error instanceof EvaluationError) || attempt === 1) throw error;
      correction = '\nRepair the supplied previousPlan to resolve these exact problems. Preserve its already-supported edits and IDs; do not start an unrelated new plan. Do not add unsupported footage, soften the score, or change the niche: ' + error.message;
    }
  }
  throw new EvaluationError('INVALID_FEEDBACK', 'The edit plan could not be verified.');
}
const OPERATION_RULES = `
REFERENCE FEEDBACK FORMAT
Write concise, direct problem-and-solution feedback. For text changes quote exact observed old wording in copyBefore and supply complete replacement wording in copy. If old wording is unreadable, absent or not supplied, copyBefore must be null; explicitly propose new text without inventing old wording. Name the affected shot and placement in editThis. Correct spelling and vague wording only when legible.
textPlaybook provides up to three useful shot-based stages (opening, development, payoff/ending as present), each with actual sceneId, short stage title, direct (primary recommended copy), curiosity (alternative), story (alternative), and concrete on-screen placement guidance. These are alternatives, not three overlays to add together. Omit stages where text harms the concept. Use semantic stages, not fabricated time windows. Never invent promises or outcomes. Keep copy ready to paste. Do not force fast cuts or CTAs. Supply five relevant hashtags.
GROUNDING CONTRACT
The exact selected targetNiche is authoritative audience context. Explain THIS footage for that audience; never replace it with another category. Every aspectNotes entry includes actual sceneIds and concrete observed details before explaining their viewer effect.
Every edit identifies targetSceneId (the actual shot where the problem occurs), sourceSceneIds (existing footage to modify or reuse), and destination (relation before/after/replace/within plus actual sceneId) for MOVE, REPLACE and INSERT. sceneIds is the union of all source/target/destination references. For reshoot, sourceSceneIds is empty: describe precisely what to record in useThis, without claiming it exists.
For a hook fix say which observed shot replaces the current opening, where it goes and what stays. For a pacing fix name the particular repeated content; do not tell the creator to decide what is repetitive. For overlay/CTA/caption changes copyKind must match the change and copy must contain usable complete text.
Do not add text or CTAs merely to fill fields. If no major changes are justified, edits and reeditPlan may be empty. KEEP instructions must fit the changes: a full ending can remain while a short preview is reused at the opening.
The system derives checklist wording from the validated edits. Supply a coherent execution order via reeditPlan editIds.
For SHORTEN identify an observable cut point and the shot that follows. If a static title/graphic has no event to cut on, choose a concrete proposed hold length appropriate to its readable text, explicitly as a NEW edit instruction rather than an observed timestamp. Never stop at keep a concise hold, trim as needed or make it shorter.
`;
const REVIEW_RULES = `Check every important claim and recommendation against the attached original ordered images, then the inventory and niche-aware interpretation. Inspect the actual referenced shot, not just valid IDs. If the inventory conflicts with the images, report the conflict and reject unsupported advice. Images are primary evidence; niche and creator context never establish visual facts. Return only the review schema. Treat the plan as unverified claims.
supported: every major assertion (including summary, aspect notes, strengths, weaknesses, captions, copy and KEEP) is supported by observed content or explicitly labelled a proposed new edit. Valid IDs alone are not proof. Reject invented shots, text, spoken claims, comparisons, outcomes or creator promises.
specific: each primary edit and aspect explanation contains recognizable details of THIS footage, not category advice. A concrete noun plus generic advice still fails.
executable: every change says exactly what to KEEP/REMOVE/SHORTEN/MOVE/REPLACE/INSERT, the footage to use and placement/order. A hook fix identifies its existing replacement or an explicitly labelled reshoot. A pacing fix identifies actual content to modify. Source, target and destination references must match the prose. Reject vague instructions even with valid references.
Validate every textPlaybook alternative and guidance against its referenced shot. copyBefore must quote actual legible inventory text or supplied caption, never guessed transcription. Hashtags must fit this footage and audience. Reject unsupported claims in alternative copy too.
copyComplete: any text/CTA/caption recommendation includes complete appropriate copy, including cases incorrectly labelled copyKind=none.
Check priority and the checklist against KEEP and edits; reject contradictions unless a clear partial-use or preview explanation resolves them. Do not require edits or CTAs for a strong video. Respect cinematic stillness and the chosen concept. Apply the same standard in Korean and English without lexical-overlap or word-count rules.
Report concrete repair instructions in issues for every failure. Do not invent a new diagnosis or a numerical score.`;

export function validateQuotedText(plan: import('./contracts').Feedback, inventory: import('./contracts').VideoInventory | null, caption: string): void {
  for (const edit of plan.edits) {
    if (!edit.copyBefore) continue;
    const sources = edit.copyKind === 'caption' ? [caption] : (inventory?.visibleText ?? []).filter(t => t.state === 'legible' && t.sceneId === edit.targetSceneId).map(t => t.wording || '');
    if (!sources.some(source => source.includes(edit.copyBefore!))) throw new EvaluationError('UNGROUNDED_FEEDBACK', 'The quoted original words were not verified in the affected shot or submitted caption. Use exact observed words; for unreadable text propose new copy without claiming an original quote.');
  }
}
