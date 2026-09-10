import { ASPECTS, type VideoInventory, type Interpretation, type MediaEvidence, type GroundingReport } from './contracts';
import { TARGET_NICHES, NICHE_CONTEXT, type TargetNiche } from './niches';
import { object, text, list, choice, observationSchema, validateShape, validateObservations, EvaluationError } from './validation';
import { imageContent } from './grounding';
import { callStructured } from './provider';
import { OBSERVATION_PROMPT } from './prompts';

export const interpretationSchema = object({
  targetNiche: choice(TARGET_NICHES), observations: observationSchema,
  aspectContext: object(Object.fromEntries(ASPECTS.map(a => [a, object({ sceneIds: list(text(), 1), interpretation: text(5), nicheReason: text(5) })]))),
});
export function validateInterpretation(raw: unknown, inventory: VideoInventory, e: MediaEvidence, niche: TargetNiche, transcriptAvailable: boolean, grounding: GroundingReport): Interpretation {
  validateShape(raw, interpretationSchema);
  const result = raw as Interpretation;
  if (result.targetNiche !== niche) throw new EvaluationError('INVALID_NICHE', 'The selected Target Niche was changed by the review.');
  // The interpretation stage must reuse facts, not write a new inventory.
  const sameScenes = result.observations.scenes.length === inventory.scenes.length && result.observations.scenes.every((scene, index) => {
    const original = inventory.scenes[index];
    return scene.id === original.id && scene.section === original.section && scene.description === original.description && scene.frameIds.length === original.frameIds.length && new Set(scene.frameIds).size === scene.frameIds.length && scene.frameIds.every(id => original.frameIds.includes(id));
  });
  if (!sameScenes) throw new EvaluationError('UNGROUNDED_ANALYSIS', 'The interpretation changed the verified footage inventory.');
  result.observations.scenes = structuredClone(inventory.scenes);
  const ids = new Set(inventory.scenes.map(s => s.id));
  for (const a of ASPECTS) {
    const refs = result.aspectContext[a].sceneIds;
    if (new Set(refs).size !== refs.length || refs.some(id => !ids.has(id))) throw new EvaluationError('UNGROUNDED_ANALYSIS', 'An aspect interpretation referenced unsupported footage.');
  }
  if (grounding.status !== 'HIGH') result.observations.confidence = 'medium';
  validateObservations(result.observations, e, transcriptAvailable);
  return result;
}
export async function interpret(apiKey: string, model: string, inventory: VideoInventory, e: MediaEvidence, niche: TargetNiche, transcript: string, grounding: GroundingReport, language: string, call = callStructured): Promise<Interpretation> {
  const data = {
    language, targetNiche: niche, audienceContext: NICHE_CONTEXT[niche], inventory,
    transcript: transcript || null, groundingStatus: grounding.status, durationSeconds: e.durationSeconds,
    frameIndex: e.frames.map(f => ({ id: f.id, timeSec: f.timeSec })),
    actualFirstFrameId: e.frames[0].id,
    openingFrameIds: e.frames.filter(f => f.timeSec <= Math.min(3, e.durationSeconds)).map(f => f.id),
    endingFrameIds: e.frames.filter(f => f.timeSec >= Math.max(0, e.durationSeconds - Math.max(1, e.durationSeconds * .1))).map(f => f.id),
  };
  let correction = '';
  let previousInterpretation: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await call(apiKey, model, OBSERVATION_PROMPT + '\n' + INTERPRETATION_RULES + correction, [{ type: 'input_text', text: JSON.stringify({ ...data, previousInterpretation }) }, ...imageContent(e)], interpretationSchema, 'previral_interpretation');
    previousInterpretation = raw;
    try { return validateInterpretation(raw, inventory, e, niche, Boolean(transcript), grounding); }
    catch (error) {
      if (!(error instanceof EvaluationError) || attempt === 1) throw error;
      correction = `\nRepair this specific validation issue without adding footage or changing the selected niche: ${error.message}`;
    }
  }
  throw new EvaluationError('INVALID_ANALYSIS', 'The evidence could not be interpreted.');
}
const INTERPRETATION_RULES = `This stage receives the verified inventory AND original ordered images. Re-examine cited frames for every qualitative judgment. A real frame ID alone does not justify a claim. If images contradict the inventory or omit essential evidence, use insufficient coverage/unknown and describe the conflict; do not invent facts or proceed confidently. Preserve exact inventory scenes.
Return the interpretation envelope. targetNiche must exactly equal the submitted value. The niche is authoritative audience context, not a claim about what the footage contains.
Copy inventory.scenes exactly, including descriptions, order, sections and frameIds, into observations.scenes. Do not rewrite them. Keep the concept grounded in mainSubject and structure.
For each aspect supply observed sceneIds, an interpretation of their effect on viewers, and nicheReason explaining why that effect matters to this selected audience. No category bonus or assumed content convention. The same LEGO subject may intentionally address Photography or Toys & Hobbies; respect the chosen audience without inventing photographic instruction or a build.
Use inventory evidence for each trait. firstFrame must include actualFirstFrameId. ALL frameIds for firstFrame, openingClarity, curiosity and anticipation MUST be from openingFrameIds, even if the first scene continues beyond three seconds. Do not copy the whole first scene's frameIds blindly. ending must include an ID from endingFrameIds. frameIndex supplies actual frame times; do not estimate times from frame numbers. For a single continuous shot, opening and ending may legitimately share a scene ID while citing the appropriate frames. Do not penalize a single shot for being one shot.
Every weakness and strength needs source scene IDs. A not_observed payoff is different from an unclear payoff. If missing evidence prevents required judgments, use unknown/low confidence and insufficient coverage. Never improve a score because the reviewer could not determine a fact.
No rating or performance percentage may be generated. Only qualitative judgments feed the existing scoring engine.`;
