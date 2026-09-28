import type { EvidenceAnalysis, Frame, ShotEvidence } from '../../../evaluation/contracts';

export const SEMANTIC_PLANNER_VERSION = 'semantic-evidence-planner-v1';
export type SemanticSelectionReason =
  | 'actual_first_frame' | 'opening' | 'representative_of_shot' | 'repetition_comparison'
  | 'high_visual_change' | 'transition_boundary' | 'strongest_deterministic_candidate'
  | 'weakest_deterministic_candidate' | 'potential_payoff' | 'ending' | 'actual_ending'
  | 'full_reel_coverage' | 'unresolved_semantic_interval';
export type PlannedSemanticFrame = { frameId: string; timeSec: number; selectionReasons: SemanticSelectionReason[]; sourceEvidenceIds: string[] };
export type PlannedSemanticInterval = { startSec: number; endSec: number; shotIds: string[]; frameIds: string[]; selectionReasons: SemanticSelectionReason[]; sourceEvidenceIds: string[] };
export type SemanticEvidencePlan = {
  version: typeof SEMANTIC_PLANNER_VERSION; sourceFingerprint: string;
  timeline: { startSec: 0; endSec: number; fullReelCoverage: true };
  frames: PlannedSemanticFrame[]; intervals: PlannedSemanticInterval[];
  structuralCoverage: Array<{ shotId: string; startSec: number; endSec: number; representativeFrameId: string | null; selectedForInference: boolean }>;
  unresolvedIntervals: PlannedSemanticInterval[];
  limits: { maxFrames: number; maxIntervals: number };
  limitations: string[];
};

type PlannerOptions = { maxFrames?: number; maxIntervals?: number };

export function planSemanticEvidence(analysis: EvidenceAnalysis, frames: Frame[], options: PlannerOptions = {}): SemanticEvidencePlan {
  const maxFrames = options.maxFrames ?? 32; const maxIntervals = options.maxIntervals ?? 96;
  if (!Number.isInteger(maxFrames) || maxFrames < 4 || !Number.isInteger(maxIntervals) || maxIntervals < 4) throw new Error('Semantic evidence limits must allow at least four inputs.');
  if (!analysis.sourceFingerprint || !analysis.shots.length || !frames.length) throw new Error('Phase 2 evidence is required for semantic planning.');
  const orderedFrames = [...frames].sort((a, b) => a.timeSec - b.timeSec);
  if (orderedFrames[0].id !== analysis.firstFrame.id) throw new Error('Semantic planning requires the actual first frame from Phase 2.');
  if (orderedFrames.at(-1)!.id !== analysis.endingFrame.id) throw new Error('Semantic planning requires the actual ending frame from Phase 2.');
  const frameById = new Map(orderedFrames.map(frame => [frame.id, frame]));
  const shotById = new Map(analysis.shots.map(shot => [shot.id, shot]));
  if (analysis.shots.some(shot => shot.representativeFrameId && !frameById.has(shot.representativeFrameId))) throw new Error('Phase 2 shot representative frames must resolve to retained frames.');
  const selected = new Map<string, PlannedSemanticFrame>();
  const nearest = (timeSec: number) => orderedFrames.reduce((best, frame) => Math.abs(frame.timeSec - timeSec) < Math.abs(best.timeSec - timeSec) ? frame : best, orderedFrames[0]);
  const add = (frame: Frame, reason: SemanticSelectionReason, evidenceIds: string[]) => {
    const existing = selected.get(frame.id);
    if (existing) {
      if (!existing.selectionReasons.includes(reason)) existing.selectionReasons.push(reason);
      for (const id of evidenceIds) if (!existing.sourceEvidenceIds.includes(id)) existing.sourceEvidenceIds.push(id);
    } else if (selected.size < maxFrames) selected.set(frame.id, { frameId: frame.id, timeSec: frame.timeSec, selectionReasons: [reason], sourceEvidenceIds: [...new Set(evidenceIds)] });
  };
  const representative = (shot: ShotEvidence): Frame | null => {
    const preferred = shot.representativeFrameId ? frameById.get(shot.representativeFrameId) : null;
    if (preferred && preferred.timeSec >= shot.startSec && preferred.timeSec <= shot.endSec) return preferred;
    const measurement = analysis.measurements.find(row => row.id === shot.representativeMeasurementId);
    const candidates = orderedFrames.filter(frame => frame.timeSec >= shot.startSec && frame.timeSec <= shot.endSec);
    return measurement && candidates.length ? candidates.reduce((best, frame) => Math.abs(frame.timeSec - measurement.timeSec) < Math.abs(best.timeSec - measurement.timeSec) ? frame : best, candidates[0]) : null;
  };

  add(orderedFrames[0], 'actual_first_frame', [analysis.firstFrame.id, analysis.firstFrame.measurementId]);
  add(orderedFrames[0], 'opening', [analysis.opening.id, ...analysis.opening.measurementIds]);
  add(orderedFrames.at(-1)!, 'ending', [analysis.endingTail.id, ...analysis.endingTail.measurementIds]);
  add(orderedFrames.at(-1)!, 'actual_ending', [analysis.endingFrame.id, analysis.endingFrame.measurementId]);

  const coverageSlots = Math.min(analysis.shots.length, Math.max(4, Math.ceil(maxFrames / 2)));
  for (let index = 0; index < coverageSlots; index++) {
    const sourceIndex = coverageSlots === 1 ? 0 : Math.round(index * (analysis.shots.length - 1) / (coverageSlots - 1));
    const shot = analysis.shots[sourceIndex];
    const frame = representative(shot);
    if (frame) add(frame, 'full_reel_coverage', [shot.id, shot.representativeMeasurementId]);
  }

  const openingFrames = orderedFrames.filter(frame => frame.timeSec <= analysis.opening.endSec);
  for (const index of [Math.floor((openingFrames.length - 1) / 2), openingFrames.length - 1]) if (openingFrames[index]) add(openingFrames[index], 'opening', [analysis.opening.id]);

  for (const candidate of [...analysis.repeatedShotCandidates].sort((a, b) => b.similarity - a.similarity).slice(0, 8)) {
    for (const shotId of candidate.shotIds) { const shot = shotById.get(shotId); const frame = shot ? representative(shot) : null; if (shot && frame) add(frame, 'repetition_comparison', [candidate.id, shot.id, shot.representativeMeasurementId]); }
  }
  for (const measurement of [...analysis.measurements].sort((a, b) => b.visualChangeFromPrevious - a.visualChangeFromPrevious || a.timeSec - b.timeSec).slice(0, 6)) add(nearest(measurement.timeSec), 'high_visual_change', [measurement.id]);
  for (const shot of [...analysis.shots.slice(1)].sort((a, b) => b.boundary.confidence - a.boundary.confidence || a.startSec - b.startSec).slice(0, 6)) {
    add(nearest(Math.max(0, shot.startSec - .001)), 'transition_boundary', [shot.id, shot.boundary.measurementId]);
    add(nearest(shot.startSec), 'transition_boundary', [shot.id, shot.boundary.measurementId]);
  }
  const quality = (shot: ShotEvidence) => shot.quality.contrast + shot.quality.sharpness - shot.quality.blockiness;
  const rankedQuality = [...analysis.shots].sort((a, b) => quality(b) - quality(a) || a.startSec - b.startSec);
  const strongest = representative(rankedQuality[0]); const weakest = representative(rankedQuality.at(-1)!);
  if (strongest) add(strongest, 'strongest_deterministic_candidate', [rankedQuality[0].id, rankedQuality[0].representativeMeasurementId]);
  if (weakest) add(weakest, 'weakest_deterministic_candidate', [rankedQuality.at(-1)!.id, rankedQuality.at(-1)!.representativeMeasurementId]);
  const laterMeasurements = analysis.measurements.filter(row => row.timeSec >= analysis.endingFrame.timeSec / 2).sort((a, b) => b.visualChangeFromPrevious - a.visualChangeFromPrevious || b.timeSec - a.timeSec);
  if (laterMeasurements[0]) add(nearest(laterMeasurements[0].timeSec), 'potential_payoff', [laterMeasurements[0].id]);
  add(orderedFrames.at(-1)!, 'potential_payoff', [analysis.endingFrame.id]);
  for (const shot of analysis.shots) { const frame = representative(shot); if (frame) add(frame, 'representative_of_shot', [shot.id, shot.representativeMeasurementId]); }

  const framesOut = [...selected.values()].map(frame => ({ ...frame, selectionReasons: [...frame.selectionReasons].sort(), sourceEvidenceIds: [...frame.sourceEvidenceIds].sort() })).sort((a, b) => a.timeSec - b.timeSec || a.frameId.localeCompare(b.frameId));
  const selectedIds = new Set(framesOut.map(frame => frame.frameId));
  const structuralCoverage = analysis.shots.map(shot => { const frame = representative(shot); return { shotId: shot.id, startSec: shot.startSec, endSec: shot.endSec, representativeFrameId: frame?.id ?? null, selectedForInference: frame ? selectedIds.has(frame.id) : false }; });
  const intervalForShot = (shot: ShotEvidence, reasons: SemanticSelectionReason[]): PlannedSemanticInterval => ({
    startSec: shot.startSec, endSec: shot.endSec, shotIds: [shot.id], frameIds: representative(shot) ? [representative(shot)!.id] : [], selectionReasons: reasons,
    sourceEvidenceIds: [shot.id, ...shot.measurementIds],
  });
  const intervalMap = new Map<string, PlannedSemanticInterval>();
  const addInterval = (shot: ShotEvidence, reason: SemanticSelectionReason) => {
    const existing = intervalMap.get(shot.id);
    if (existing) { if (!existing.selectionReasons.includes(reason)) existing.selectionReasons.push(reason); }
    else if (intervalMap.size < maxIntervals) intervalMap.set(shot.id, intervalForShot(shot, [reason]));
  };
  addInterval(analysis.shots[0], 'opening');
  addInterval(analysis.shots.at(-1)!, 'ending');
  for (const shot of analysis.shots.filter(candidate => { const frame = representative(candidate); return frame ? selectedIds.has(frame.id) : false; })) addInterval(shot, 'representative_of_shot');
  for (const shot of [...analysis.shots].sort((a, b) => b.boundary.confidence - a.boundary.confidence || a.startSec - b.startSec)) addInterval(shot, 'transition_boundary');
  const intervals = [...intervalMap.values()].sort((a, b) => a.startSec - b.startSec);
  const unresolvedIntervals = analysis.shots.filter(shot => { const frame = representative(shot); return !frame || !selectedIds.has(frame.id); }).map(shot => intervalForShot(shot, ['unresolved_semantic_interval']));
  const limitations = [
    'The plan reuses Phase 2 evidence and does not request another full-duration decode.',
    'Full-Reel semantic coverage is a bounded timeline-spanning sample; shots outside the inference budget remain explicitly unresolved.',
    'Selection nominates semantic inputs; it does not assert meaning, redundancy, payoff, or loop quality.',
  ];
  if (analysis.shots.length > maxFrames) limitations.push('The frame budget is smaller than the shot count; complete deterministic structure is retained and unprocessed shots remain unresolved.');
  if (analysis.shots.length > maxIntervals) limitations.push('The expensive interval budget is smaller than the shot count; structuralCoverage still retains every Phase 2 shot.');
  return { version: SEMANTIC_PLANNER_VERSION, sourceFingerprint: analysis.sourceFingerprint, timeline: { startSec: 0, endSec: analysis.endingFrame.timeSec + Math.max(0, analysis.shots.at(-1)!.endSec - analysis.endingFrame.timeSec), fullReelCoverage: true }, frames: framesOut, intervals, structuralCoverage, unresolvedIntervals, limits: { maxFrames, maxIntervals }, limitations };
}
