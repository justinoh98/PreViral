import { ASPECTS, INVENTORY_ELEMENTS, type VideoInventory, type Interpretation, type Level } from '../../evaluation/contracts';
import type { VisualVerification } from '../../evaluation/grounding';
import type { TargetNiche } from '../../evaluation/niches';
import { observations, request } from './evaluatorCases';

export function inventory(): VideoInventory {
  const o = observations();
  return {
    visibleText: [], observedActions: [],
    mainSubject: 'A miniature wet street photographed with a small lamp.', structure: 'A wide setup is followed by lamp placement and the finished photograph.',
    scenes: o.scenes, openingSceneId: 'opening', endingSceneId: 'ending', majorProgression: ['opening', 'middle', 'ending'],
    elements: Object.fromEntries(INVENTORY_ELEMENTS.map(key => [key, key === 'strongestMoment' || key === 'payoff' ? { state: 'observed', description: 'The final photograph shows lamp reflections across the wet miniature street.', sceneIds: ['ending'] } : { state: key === 'speech' || key === 'audioBehavior' ? 'unclear' : 'not_observed', description: 'This element could not be established from the supplied evidence.', sceneIds: [] }])) as VideoInventory['elements'],
    confidence: 'high', limitations: [],
  };
}
export function verification(i = inventory()): VisualVerification {
  return { specificToVideo: true, sequenceSupported: true, confidence: 'high', supportedSceneIds: i.scenes.map(s => s.id), unsupportedClaims: [], missingEvidence: [] };
}
export function interpretation(niche: TargetNiche = 'Toys & Hobbies', i = inventory(), level: Level = 'strong'): Interpretation {
  const o = observations(level); o.scenes = structuredClone(i.scenes);
  return { targetNiche: niche, observations: o, aspectContext: Object.fromEntries(ASPECTS.map(a => [a, { sceneIds: a === 'hookStrength' ? [i.openingSceneId] : [i.endingSceneId], interpretation: 'The lamp reflections make the change in this miniature street visible.', nicheReason: niche === 'Photography' ? 'The visible lighting change gives photography viewers a concrete result to inspect.' : 'The miniature street and its changed lighting give this audience a recognizable subject to inspect.' }])) as Interpretation['aspectContext'] };
}
export function continuousShot(): VideoInventory {
  const i = inventory();
  i.mainSubject = 'A red paper boat reflected in a puddle.';
  i.structure = 'One continuous locked shot; ripples gradually distort the reflection while the boat remains centred.';
  i.scenes = [{ id: 'boat', section: 'opening', description: 'A red paper boat stays centred in a puddle as ripples distort its reflection; the same composition remains at the ending.', frameIds: request().evidence.frames.map(f => f.id) }];
  i.openingSceneId = i.endingSceneId = 'boat'; i.majorProgression = ['boat'];
  for (const item of Object.values(i.elements)) { item.state = 'unclear'; item.sceneIds = []; item.description = 'Not enough evidence to determine this element.'; }
  i.elements.strongestMoment = { state: 'observed', description: 'Ripples bend the red boat reflection while the boat stays still.', sceneIds: ['boat'] };
  return i;
}
