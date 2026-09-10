import { GROUNDING_VERSION, INVENTORY_ELEMENTS, type VideoInventory, type MediaEvidence, type GroundingReport } from './contracts';
import type { TargetNiche } from './niches';
import { object, text, list, choice, validateShape, observationSchema, EvaluationError } from './validation';

const element = object({ state: choice(['observed', 'not_observed', 'unclear']), description: text(), sceneIds: list(text()) });
export const inventorySchema = object({
  visibleText: list(object({ sceneId: text(), frameIds: list(text(), 1), state: choice(['legible', 'unclear']), wording: { anyOf: [text(), { type: 'null' }] } })),
  observedActions: list(object({ sceneId: text(), frameIds: list(text(), 1), description: text(5) })),
  mainSubject: text(3), structure: text(3), scenes: observationSchema.properties!.scenes,
  openingSceneId: text(), endingSceneId: text(), majorProgression: list(text(), 1),
  elements: object(Object.fromEntries(INVENTORY_ELEMENTS.map(k => [k, element]))),
  confidence: choice(['high', 'medium', 'low']), limitations: list(text()),
});
export type VisualVerification = {
  specificToVideo: boolean; sequenceSupported: boolean; confidence: 'high' | 'medium' | 'low';
  supportedSceneIds: string[]; unsupportedClaims: string[]; missingEvidence: string[];
};
export const verificationSchema = object({
  specificToVideo: { type: 'boolean' }, sequenceSupported: { type: 'boolean' }, confidence: choice(['high', 'medium', 'low']),
  supportedSceneIds: list(text()), unsupportedClaims: list(text()), missingEvidence: list(text()),
});
export function validateInventory(raw: unknown, e: MediaEvidence, transcript: string): VideoInventory {
  validateShape(raw, inventorySchema);
  const inventory = raw as VideoInventory;
  const frames = new Map(e.frames.map(f => [f.id, f]));
  const scenes = new Map(inventory.scenes.map(s => [s.id, s]));
  const refs = (values: string[], known: Map<string, unknown>) => {
    if (new Set(values).size !== values.length || values.some(id => !known.has(id))) throw new EvaluationError('UNGROUNDED_INVENTORY', 'An inventory reference is missing or duplicated.');
  };
  if (scenes.size !== inventory.scenes.length) throw new EvaluationError('UNGROUNDED_INVENTORY', 'Scene IDs must be unique.');
  inventory.scenes.forEach(s => refs(s.frameIds, frames));
  refs(inventory.majorProgression, scenes);
  for (const item of [...(inventory.visibleText ?? []), ...(inventory.observedActions ?? [])]) {
    refs([item.sceneId], scenes); refs(item.frameIds, frames);
    if (item.frameIds.some(id => !scenes.get(item.sceneId)!.frameIds.includes(id))) throw new EvaluationError('UNGROUNDED_INVENTORY', 'Text/action evidence must belong to the claimed shot.');
  }
  for (const item of inventory.visibleText ?? []) {
    if ((item.state === 'legible' && !item.wording?.trim()) || (item.state === 'unclear' && item.wording !== null)) throw new EvaluationError('UNGROUNDED_INVENTORY', 'Unreadable text must not receive a guessed transcription.');
  }
  if (!scenes.get(inventory.openingSceneId)?.frameIds.includes(e.frames[0].id)) throw new EvaluationError('UNGROUNDED_INVENTORY', 'The opening description must include the actual first frame.');
  if (!scenes.get(inventory.endingSceneId)?.frameIds.includes(e.frames.at(-1)!.id)) throw new EvaluationError('UNGROUNDED_INVENTORY', 'The ending description must include the actual last sampled frame.');
  if (inventory.majorProgression[0] !== inventory.openingSceneId || inventory.majorProgression.at(-1) !== inventory.endingSceneId) throw new EvaluationError('UNGROUNDED_INVENTORY', 'The progression must account for the beginning through the ending.');
  let previous = -1;
  for (const id of inventory.majorProgression) {
    const first = Math.min(...scenes.get(id)!.frameIds.map(f => frames.get(f)!.timeSec));
    if (first < previous) throw new EvaluationError('UNGROUNDED_INVENTORY', 'The described progression contradicts frame order.');
    previous = first;
  }
  for (const key of INVENTORY_ELEMENTS) {
    const item = inventory.elements[key]; refs(item.sceneIds, scenes);
    if (item.state === 'observed' && !item.sceneIds.length && key !== 'speech') throw new EvaluationError('UNGROUNDED_INVENTORY', `The ${key} claim needs observed footage.`);
  }
  if (inventory.elements.speech.state === 'observed' && !transcript.trim()) throw new EvaluationError('UNGROUNDED_INVENTORY', 'Speech was claimed without a transcript.');
  if (!transcript.trim() && inventory.elements.speech.state !== 'unclear') throw new EvaluationError('UNGROUNDED_INVENTORY', 'Without a transcript speech is unclear, not confirmed absent. Set speech.state to unclear.');
  // Still images plus speech transcription cannot establish musical or sound-design behavior.
  if (inventory.elements.audioBehavior.state !== 'unclear') throw new EvaluationError('UNGROUNDED_INVENTORY', 'Music and sound effects were not directly heard; mark audio behavior unclear.');
  return inventory;
}

export function groundingReport(inventory: VideoInventory, raw: unknown, niche: TargetNiche, attempts: number): GroundingReport {
  validateShape(raw, verificationSchema);
  const review = raw as VisualVerification;
  const ids = new Set(inventory.scenes.map(s => s.id));
  if (new Set(review.supportedSceneIds).size !== review.supportedSceneIds.length || review.supportedSceneIds.some(id => !ids.has(id))) throw new EvaluationError('UNGROUNDED_INVENTORY', 'The visual verification cited unknown or duplicate scenes.');
  const supported = new Set(review.supportedSceneIds);
  const issues = [...review.unsupportedClaims, ...review.missingEvidence];
  if (!review.specificToVideo) issues.push('The description does not yet identify this particular footage.');
  if (!review.sequenceSupported) issues.push('The opening, development or ending could not be verified.');
  if (inventory.scenes.some(s => !supported.has(s.id))) issues.push('Some described footage could not be verified against the supplied images.');
  // No score, cut count, scene count or vocabulary count contributes to this status.
  const inadequate = !review.specificToVideo || !review.sequenceSupported || review.unsupportedClaims.length > 0 || inventory.scenes.some(s => !supported.has(s.id)) || review.confidence === 'low' || inventory.confidence === 'low';
  const status = inadequate ? (supported.size ? 'LOW' : 'FAILED') : review.confidence === 'high' && inventory.confidence === 'high' && !review.missingEvidence.length ? 'HIGH' : 'MEDIUM';
  return { version: GROUNDING_VERSION, targetNiche: niche, status, inventory, issues, attempts, verifiedSceneIds: review.supportedSceneIds };
}

export function imageContent(e: MediaEvidence): unknown[] {
  return e.frames.flatMap(frame => [{ type: 'input_text', text: `Evidence ${frame.id}, decoded at ${frame.timeSec.toFixed(3)}s` }, { type: 'input_image', image_url: frame.imageUrl, detail: 'high' }]);
}
