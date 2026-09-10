import { TRAITS, ASPECTS, EVIDENCE_VERSION, type Level, type Observations, type Feedback, type EvaluationRequest } from '../../evaluation/contracts';
import { sampleTimes } from '../../src/evaluation/mediaEvidence';

export function observations(level: Level = 'competent'): Observations {
  const frames = request().evidence.frames;
  const last = frames.at(-1)!.id; const penultimate = frames.at(-2)!.id;
  return {
    concept: 'A miniature street photograph is constructed and revealed.', confidence: 'high', coverage: 'sufficient', audioEssential: false, limitations: [],
    scenes: [
      { id: 'opening', section: 'opening', description: 'Wide shot of the miniature street before lighting is added.', frameIds: ['frame-1', 'frame-2'] },
      { id: 'middle', section: 'middle', description: 'The creator moves a small lamp beside the wet street.', frameIds: ['frame-16'] },
      { id: 'ending', section: 'ending', description: 'Close-up of the finished photograph with reflections in the street.', frameIds: [penultimate, last] },
    ],
    traits: Object.fromEntries(TRAITS.map(key => [key, { level, confidence: 'high', reason: 'The observed images establish the subject and give the viewer a clear visual promise.', frameIds: ['ending', 'replay', 'payoff'].includes(key) ? [penultimate, last] : ['frame-1', 'frame-2'] }])) as Observations['traits'],
    weaknesses: [], strengths: [{ description: 'The finished photograph shows a distinct change in the reflections.', sceneIds: ['ending'] }], strongestSceneId: 'ending', reusableHookSceneId: 'ending',
    textObservation: 'No text is visible in the sampled images.', audioObservation: 'Audio quality was not assessed.', watermark: 'unknown', safeZone: 'unknown',
  };
}
export const calibrationCases = [
  { name: 'A: empty setup, unclear purpose, no progression or satisfying finish', level: 'ineffective' as Level, low: .5, high: 1.5 },
  { name: 'B: recognizable subject with weak opening and repetitive development', level: 'weak' as Level, low: 1.5, high: 2.5 },
  { name: 'C: understandable setup, functional sequence, ordinary result', level: 'competent' as Level, low: 2.5, high: 3.5 },
  { name: 'D: immediate intrigue, useful progression, earned visual reveal', level: 'strong' as Level, low: 3.5, high: 4.4 },
  { name: 'E: extraordinary opening and payoff with sustained inventive progression', level: 'exceptional' as Level, low: 4.5, high: 5 },
];
export function request(): EvaluationRequest {
  const times = sampleTimes(15);
  return { title: 'miniature.mp4', niche: 'Toys & Hobbies', captionInput: '', videoConcept: '', audioType: '', fileFormat: 'MP4', fileSizeMb: 10, language: 'en', evidence: { version: EVIDENCE_VERSION, durationSeconds: 15, width: 1080, height: 1920, audioStatus: 'unavailable', frames: times.map((timeSec, i) => ({ id: `frame-${i + 1}`, timeSec, imageUrl: 'data:image/jpeg;base64,YQ==' })) } };
}
export function feedback(): Feedback {
  return {
    aspectNotes: Object.fromEntries(ASPECTS.map(key => [key, { verdict: 'The miniature scene is clearly established in the images.', detail: 'The lamp changes how the reflections appear in the finished photograph.', sceneIds: ['opening', 'middle', 'ending'] }])) as Feedback['aspectNotes'],
    strengths: ['Keep the finished photograph with its reflections.'], weaknesses: [], textObservation: 'No text was visible.', audioObservation: 'Audio quality was not assessed.',
    summary: 'The miniature street is clear and the final photograph is worth keeping.', keep: [{ sceneId: 'ending', instruction: 'Keep the finished photograph with reflections as the full ending.' }], edits: [], reeditPlan: [], caption: '', captionHooks: [], valueCTA: '', cliffhangerCTA: '', commentQuestion: '', textPlaybook: [], hashtags: ['#ToyPhotography', '#MiniatureStreet', '#CreativeLighting', '#MiniaturePhotography', '#ToysAndHobbies'],
  };
}
