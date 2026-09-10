import { ASPECTS, TRAITS, LEVELS, EVIDENCE_VERSION, type Observations, type MediaEvidence, type Feedback, type EvaluationRequest } from './contracts';
import { isTargetNiche } from './niches';

export class EvaluationError extends Error {
  constructor(public code: string, message: string, public status = 422, public grounding?: import('./contracts').GroundingReport) { super(message); }
}
export type Schema = { type?: string; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean; items?: Schema; enum?: readonly unknown[]; minItems?: number; maxItems?: number; minLength?: number; maxLength?: number; minimum?: number; maximum?: number; anyOf?: Schema[] };
export const text = (minLength = 1, maxLength = 1800): Schema => ({ type: 'string', minLength, maxLength });
export const choice = (values: readonly unknown[]): Schema => ({ type: 'string', enum: values });
export const list = (items: Schema, minItems = 0, maxItems = 40): Schema => ({ type: 'array', items, minItems, maxItems });
export const object = (properties: Record<string, Schema>): Schema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const nullableText: Schema = { anyOf: [text(), { type: 'null' }] };
const ids = list(text(1, 60), 0, 64);
const judgment = object({ level: choice(LEVELS), confidence: choice(['high', 'medium', 'low']), reason: text(10), frameIds: ids });
export const observationSchema = object({
  concept: text(), confidence: choice(['high', 'medium', 'low']), coverage: choice(['sufficient', 'insufficient']),
  audioEssential: { type: 'boolean' }, limitations: list(text()),
  scenes: list(object({ id: text(1, 60), section: choice(['opening', 'middle', 'ending']), description: text(10), frameIds: list(text(1, 60), 1, 64) }), 1, 40),
  traits: object(Object.fromEntries(TRAITS.map(key => [key, judgment]))),
  weaknesses: list(object({ id: text(1, 60), aspect: choice(ASPECTS), severity: choice(['minor', 'major', 'severe']), problem: text(15), sceneIds: list(text(1, 60), 1) }), 0, 12),
  strengths: list(object({ description: text(10), sceneIds: list(text(1, 60), 1) }), 0, 8),
  strongestSceneId: nullableText, reusableHookSceneId: nullableText,
  textObservation: text(), audioObservation: text(), watermark: choice(['present', 'absent', 'unknown']), safeZone: choice(['clear', 'violation', 'unknown']),
});
export const feedbackSchema = object({
  aspectNotes: object(Object.fromEntries(ASPECTS.map(key => [key, object({ verdict: text(10), detail: text(10), sceneIds: list(text(), 1) })]))),
  strengths: list(text(10), 0, 8), weaknesses: list(text(10), 0, 12), textObservation: text(), audioObservation: text(),
  summary: text(15), keep: list(object({ sceneId: text(), instruction: text(15) }), 0, 6),
  edits: list(object({ id: text(), weaknessId: nullableText, priority: choice(['must_fix', 'should_improve', 'optional']), action: choice(['KEEP', 'REMOVE', 'SHORTEN', 'MOVE', 'REPLACE', 'INSERT']), sceneIds: list(text(), 1), footage: choice(['existing', 'reshoot']), targetSceneId: text(), sourceSceneIds: list(text()), destination: { anyOf: [{ type: 'null' }, object({ relation: choice(['before', 'after', 'replace', 'within']), sceneId: text() })] }, problem: text(10), editThis: text(15), useThis: text(10), why: text(10), copyKind: choice(['none', 'overlay', 'caption', 'cta']), copy: text(0), copyBefore: nullableText }), 0, 8),
  reeditPlan: list(object({ editId: text(), instruction: text(25) }), 0, 12),
  textPlaybook: list(object({ sceneId: text(), stage: text(), guidance: text(15), direct: text(), curiosity: text(), story: text() }), 0, 3),
  caption: text(0), captionHooks: list(text(), 0, 3), valueCTA: text(0), cliffhangerCTA: text(0), commentQuestion: text(0), hashtags: list(text(), 5, 5),
});

export function validateShape(value: unknown, schema: Schema, path = 'response'): void {
  if (schema.anyOf) {
    if (schema.anyOf.some(s => { try { validateShape(value, s, path); return true; } catch { return false; } })) return;
    throw new EvaluationError('INVALID_ANALYSIS', `${path} has an invalid value.`);
  }
  const fail = () => { throw new EvaluationError('INVALID_ANALYSIS', `${path} did not match the required structure.`); };
  if (schema.type === 'null') { if (value !== null) fail(); return; }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return fail();
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) fail();
    value.forEach((v, i) => validateShape(v, schema.items!, `${path}[${i}]`)); return;
  }
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
    const record = value as Record<string, unknown>;
    if (Object.keys(record).some(k => !Object.hasOwn(schema.properties!, k))) fail();
    for (const key of schema.required!) {
      if (!Object.hasOwn(record, key)) fail();
      validateShape(record[key], schema.properties![key], `${path}.${key}`);
    }
    return;
  }
  if (typeof value !== schema.type) fail();
  if (schema.enum && !schema.enum.includes(value)) fail();
  if (typeof value === 'string' && (value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity))) fail();
  if (typeof value === 'number' && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) fail();
}

export function validateEvidence(e: MediaEvidence): void {
  if (e?.sourceFingerprint !== undefined && (typeof e.sourceFingerprint !== 'string' || !/^\d+-[a-f0-9]{8}-[a-f0-9]{8}$/.test(e.sourceFingerprint))) throw new EvaluationError('INVALID_VIDEO', 'The uploaded video identity is invalid.');
  if (!e || e.version !== EVIDENCE_VERSION || !Number.isFinite(e.durationSeconds) || e.durationSeconds <= 0 || e.durationSeconds > 300 || !Number.isInteger(e.width) || !Number.isInteger(e.height) || e.width <= 0 || e.height <= 0) throw new EvaluationError('INVALID_VIDEO', 'This video could not be read reliably. Use a playable video of up to five minutes.');
  if (!Array.isArray(e.frames) || e.frames.length < 4 || e.frames.length > 96) throw new EvaluationError('INSUFFICIENT_EVIDENCE', 'Not enough of the video could be read. Please retry.');
  let previous = -1;
  const seen = new Set<string>();
  for (const f of e.frames) {
    if (!f || typeof f.id !== 'string' || seen.has(f.id) || !Number.isFinite(f.timeSec) || f.timeSec <= previous || f.timeSec < 0 || f.timeSec > e.durationSeconds || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(f.imageUrl) || f.imageUrl.length > 2_000_000) throw new EvaluationError('INVALID_VIDEO', 'Video evidence could not be verified. Please retry.');
    seen.add(f.id); previous = f.timeSec;
  }
  if (e.frames[0].timeSec > .08 || e.frames.at(-1)!.timeSec < e.durationSeconds - .05) throw new EvaluationError('INSUFFICIENT_EVIDENCE', 'The beginning or ending could not be read. Please retry.');
  const maxGap = Math.max(.65, e.durationSeconds / 30);
  if (e.frames.some((f, i) => i > 0 && f.timeSec - e.frames[i - 1].timeSec > maxGap * 1.25)) throw new EvaluationError('INSUFFICIENT_EVIDENCE', 'A section of the video was not captured. Please retry.');
  if (!['provided', 'unavailable', 'absent'].includes(e.audioStatus) || (e.audioStatus === 'provided' && !e.audioWav) || (e.audioWav && !/^data:audio\/wav;base64,[A-Za-z0-9+/=]+$/.test(e.audioWav)) || (e.audioWav?.length ?? 0) > 16_000_000) throw new EvaluationError('INVALID_AUDIO', 'The audio could not be read.');
}

export function validateRequest(raw: unknown): EvaluationRequest {
  const r = raw as EvaluationRequest;
  if (!r || typeof r !== 'object' || !['en', 'ko'].includes(r.language)) throw new EvaluationError('INVALID_REQUEST', 'Invalid evaluation request.', 400);
  for (const field of ['title', 'niche', 'captionInput', 'videoConcept', 'audioType', 'fileFormat'] as const) if (typeof r[field] !== 'string' || r[field].length > 5000) throw new EvaluationError('INVALID_REQUEST', 'The supplied context is too long or invalid.', 400);
  if (!Number.isFinite(r.fileSizeMb) || r.fileSizeMb < 0) throw new EvaluationError('INVALID_REQUEST', 'Invalid file information.', 400);
  if (!isTargetNiche(r.niche)) throw new EvaluationError('INVALID_NICHE', 'Choose one of the listed Target Niche categories. Your selection will be used exactly as submitted.', 400);
  validateEvidence(r.evidence); return r;
}

export function validateObservations(raw: unknown, evidence: MediaEvidence, transcriptAvailable: boolean): Observations {
  validateShape(raw, observationSchema);
  const o = raw as Observations;
  const frameIds = new Set(evidence.frames.map(f => f.id));
  const sceneIds = new Set(o.scenes.map(s => s.id));
  const checkRefs = (refs: string[], known: Set<string>) => { if (new Set(refs).size !== refs.length || refs.some(id => !known.has(id))) throw new EvaluationError('UNGROUNDED_ANALYSIS', 'The review referenced missing or duplicate evidence.'); };
  if (sceneIds.size !== o.scenes.length || new Set(o.weaknesses.map(w => w.id)).size !== o.weaknesses.length) throw new EvaluationError('INVALID_ANALYSIS', 'Duplicate evidence identifiers.');
  o.scenes.forEach(s => checkRefs(s.frameIds, frameIds));
  o.weaknesses.forEach(w => checkRefs(w.sceneIds, sceneIds));
  o.strengths.forEach(s => checkRefs(s.sceneIds, sceneIds));
  for (const id of [o.strongestSceneId, o.reusableHookSceneId]) if (id !== null) checkRefs([id], sceneIds);
  for (const key of TRAITS) {
    const j = o.traits[key]; checkRefs(j.frameIds, frameIds);
    if (!['unknown', 'not_applicable'].includes(j.level) && !j.frameIds.length) throw new EvaluationError('UNGROUNDED_ANALYSIS', `No evidence supports ${key}.`);
    if (['exceptional', 'outstanding'].includes(j.level) && (j.confidence !== 'high' || j.frameIds.length < 2)) throw new EvaluationError('INSUFFICIENT_EVIDENCE', 'An exceptional judgment needs corroborating evidence.');
    if (key !== 'textLegibility' && j.level === 'not_applicable') throw new EvaluationError('INSUFFICIENT_EVIDENCE', 'A required creative aspect could not be evaluated.');
  }
  for (const key of ['firstFrame', 'openingClarity', 'curiosity', 'anticipation'] as const) {
    if (o.traits[key].frameIds.some(id => evidence.frames.find(f => f.id === id)!.timeSec > Math.min(3, evidence.durationSeconds))) throw new EvaluationError('UNGROUNDED_ANALYSIS', 'Opening judgments must use opening evidence.');
  }
  if (!o.traits.firstFrame.frameIds.includes(evidence.frames[0].id)) throw new EvaluationError('UNGROUNDED_ANALYSIS', 'First-frame attention requires the actual first frame.');
  const lastWindow = Math.max(0, evidence.durationSeconds - Math.max(1, evidence.durationSeconds * .1));
  if (o.traits.ending.level !== 'unknown' && !o.traits.ending.frameIds.some(id => evidence.frames.find(f => f.id === id)!.timeSec >= lastWindow)) throw new EvaluationError('UNGROUNDED_ANALYSIS', 'The ending judgment needs ending evidence.');
  const covered = new Set(o.scenes.flatMap(s => s.frameIds));
  if (o.coverage !== 'sufficient' || o.confidence === 'low' || (o.audioEssential && !transcriptAvailable) || !covered.has(evidence.frames[0].id) || !covered.has(evidence.frames.at(-1)!.id)) throw new EvaluationError('INSUFFICIENT_EVIDENCE', 'Not enough of this Reel could be understood to give an honest rating. Please retry with a clearer or more accessible export.');
  return o;
}

export function validateFeedback(raw: unknown, o: Observations): Feedback {
  validateShape(raw, feedbackSchema);
  const f = raw as Feedback;
  const scenes = new Set(o.scenes.map(s => s.id));
  if (f.hashtags.some(tag => !/^#[\p{L}\p{N}_]+$/u.test(tag)) || new Set(f.hashtags.map(tag => tag.toLowerCase())).size !== 5) throw new EvaluationError('INVALID_FEEDBACK', 'Provide exactly five distinct, valid hashtags.');
  for (const row of f.textPlaybook ?? []) if (!scenes.has(row.sceneId)) throw new EvaluationError('UNGROUNDED_FEEDBACK', 'Text placement must identify observed footage.');
  const weaknesses = new Map(o.weaknesses.map(w => [w.id, w]));
  const edits = new Map(f.edits.map(e => [e.id, e]));
  for (const a of ASPECTS) if (!f.aspectNotes[a].sceneIds.length || f.aspectNotes[a].sceneIds.some(id => !scenes.has(id))) throw new EvaluationError('UNGROUNDED_FEEDBACK', 'An aspect explanation needs observed footage.');
  if (edits.size !== f.edits.length || f.edits.filter(e => e.priority === 'must_fix').length > 3) throw new EvaluationError('INVALID_FEEDBACK', 'The editing priorities were not clear enough.');
  f.keep.forEach(k => { if (!scenes.has(k.sceneId)) throw new EvaluationError('UNGROUNDED_FEEDBACK', 'Keep instruction refers to unknown footage.'); });
  for (const edit of f.edits) {
    if (edit.sceneIds.some(id => !scenes.has(id)) || (edit.weaknessId !== null && !weaknesses.has(edit.weaknessId))) throw new EvaluationError('UNGROUNDED_FEEDBACK', 'An edit refers to unobserved footage or a nonexistent problem.');
    if (edit.priority !== 'optional' && edit.weaknessId === null) throw new EvaluationError('INVALID_FEEDBACK', 'A recommended change needs an observed problem.');
    const refs = [edit.targetSceneId, ...edit.sourceSceneIds, ...(edit.destination ? [edit.destination.sceneId] : [])];
    if (refs.some(id => !scenes.has(id) || !edit.sceneIds.includes(id)) || new Set(edit.sourceSceneIds).size !== edit.sourceSceneIds.length) throw new EvaluationError('UNGROUNDED_FEEDBACK', 'Identify the actual affected shot, source footage and destination.');
    if (edit.weaknessId && !weaknesses.get(edit.weaknessId)!.sceneIds.includes(edit.targetSceneId)) throw new EvaluationError('UNGROUNDED_FEEDBACK', 'The edit must affect the footage where the problem was observed.');
    if (['MOVE', 'REPLACE', 'INSERT'].includes(edit.action) && !edit.destination) throw new EvaluationError('INVALID_FEEDBACK', 'Specify where the footage or text goes.');
    if (edit.action === 'MOVE' && (edit.footage !== 'existing' || !edit.sourceSceneIds.length)) throw new EvaluationError('INVALID_FEEDBACK', 'Moving footage requires an existing source shot.');
    if (edit.footage === 'reshoot' && edit.sourceSceneIds.length) throw new EvaluationError('UNGROUNDED_FEEDBACK', 'New footage cannot be labelled as an existing source.');
    if (edit.footage === 'existing' && !edit.sourceSceneIds.length && edit.copyKind === 'none') throw new EvaluationError('INVALID_FEEDBACK', 'Identify the footage to use or supply the new text.');
    if (edit.copyBefore && (edit.copyKind === 'none' || edit.copyBefore.trim() === edit.copy.trim())) throw new EvaluationError('INVALID_FEEDBACK', 'A text replacement needs different, complete replacement wording.');
    if (edit.copyKind !== 'none' && !edit.copy.trim()) throw new EvaluationError('INVALID_FEEDBACK', 'The proposed replacement text is missing.');
    if (/^(improve (the )?(hook|pacing|retention)|add (more )?(curiosity|visual interest)|use (a )?stronger (hook|first frame))[.!]?$/i.test(edit.editThis.trim())) throw new EvaluationError('INVALID_FEEDBACK', 'The editing instruction is too abstract.');
    if (edit.weaknessId && weaknesses.get(edit.weaknessId)!.aspect === 'hookStrength' && !['MOVE', 'REPLACE', 'SHORTEN', 'INSERT'].includes(edit.action)) throw new EvaluationError('INVALID_FEEDBACK', 'The opening fix needs a direct implementation.');
  }
  if (o.weaknesses.some(w => w.severity !== 'minor' && !f.edits.some(e => e.weaknessId === w.id))) throw new EvaluationError('INVALID_FEEDBACK', 'A major weakness has no editing solution.');
  if (f.reeditPlan.some(step => !edits.has(step.editId)) || f.edits.some(e => e.action !== 'KEEP' && !f.reeditPlan.some(s => s.editId === e.id))) throw new EvaluationError('INVALID_FEEDBACK', 'The re-edit checklist is incomplete.');
  const ranks = { must_fix: 0, should_improve: 1, optional: 2 };
  f.edits.sort((a, b) => ranks[a.priority] - ranks[b.priority]);
  // Preserve the proposed execution order; derive its wording from the validated operations.
  // The checklist cannot become a fresh, contradictory model-generated recommendation.
  f.reeditPlan = f.reeditPlan.filter((step, i, all) => all.findIndex(s => s.editId === step.editId) === i).map(step => {
    const edit = edits.get(step.editId)!;
    return { editId: edit.id, instruction: [edit.editThis, edit.useThis, edit.copy ? `“${edit.copy}”` : ''].filter(Boolean).join(' ') };
  });
  return f;
}
