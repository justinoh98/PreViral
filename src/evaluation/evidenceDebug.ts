import type { EvidenceAnalysis, Frame } from '../../evaluation/contracts';

export function buildEvidenceDebugSnapshot(fingerprint: string, evidence: EvidenceAnalysis, frames: Frame[]) {
  const frameIndex = frames.map(frame => ({ id: frame.id, timeSec: frame.timeSec }));
  return {
    fingerprint,
    analyzerVersion: evidence.version,
    schemaVersion: evidence.schemaVersion,
    provenance: evidence.provenance,
    capabilities: evidence.capabilities,
    firstFrame: evidence.firstFrame,
    endingFrame: evidence.endingFrame,
    representativeFrames: frameIndex,
    measurements: evidence.measurements,
    shots: evidence.shots.map(shot => ({
      id: shot.id,
      startSec: shot.startSec,
      endSec: shot.endSec,
      durationSec: shot.durationSec,
      representativeMeasurementId: shot.representativeMeasurementId,
      representativeFrameId: shot.representativeFrameId,
      boundaryKind: shot.boundary.kind,
      boundaryConfidence: shot.boundary.confidence,
      withinShotVisualChange: shot.withinShotVisualChange,
      similarShotIds: shot.similarShotIds,
      quality: shot.quality,
    })),
    repetitionCandidates: evidence.repeatedShotCandidates,
    startEndSimilarity: evidence.startEndSimilarity,
    opening: evidence.opening,
    ending: evidence.endingTail,
    audio: evidence.audio,
    text: evidence.text,
    technical: evidence.technical,
    limitations: evidence.limitations,
  };
}

export function shouldShowEvidenceDebug(search: string): boolean {
  return new URLSearchParams(search).get('previralDebug') === '1';
}
