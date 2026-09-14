import {
  ANALYZER_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  type ActivityWindow,
  type AudioAnalysis,
  type EvidenceAnalysis,
  type EvidenceValue,
  type RepeatedShotCandidate,
  type ShotEvidence,
  type TechnicalEvidence,
  type VisualMeasurement,
} from './contracts';
import { capabilityReport } from './capabilities';
import { evidenceId } from './evidence';

export type PixelFrame = { id: string; timeSec: number; width: number; height: number; pixels: Uint8ClampedArray };
type FrameMetrics = VisualMeasurement & { color: [number, number, number]; qualityScore: number };

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number, places = 4) => Number(value.toFixed(places));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function validateFrames(frames: PixelFrame[], durationSeconds: number): void {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error('A positive video duration is required.');
  if (frames.length < 2) throw new Error('At least two ordered measurements are required for local analysis.');
  for (const [index, frame] of frames.entries()) {
    if (!Number.isFinite(frame.timeSec) || frame.timeSec < 0 || frame.timeSec > durationSeconds) throw new Error('Measurement timestamps must be inside the Reel.');
    if (index && frame.timeSec <= frames[index - 1].timeSec) throw new Error('Local analysis measurements must be chronological.');
    if (!Number.isInteger(frame.width) || !Number.isInteger(frame.height) || frame.width < 2 || frame.height < 2 || frame.pixels.length !== frame.width * frame.height * 4) throw new Error('Measurement pixels do not match their dimensions.');
  }
  if (frames[0].timeSec > .08 || durationSeconds - frames.at(-1)!.timeSec > .05) throw new Error('Local analysis must include the actual opening and ending.');
}

function baseMetrics(frame: PixelFrame, index: number, sourceFingerprint: string): FrameMetrics {
  const count = frame.width * frame.height;
  const gray = new Float32Array(count);
  let red = 0; let green = 0; let blue = 0; let luminance = 0;
  for (let pixel = 0, offset = 0; pixel < count; pixel++, offset += 4) {
    const r = frame.pixels[offset]; const g = frame.pixels[offset + 1]; const b = frame.pixels[offset + 2];
    red += r; green += g; blue += b;
    const value = (r * .2126 + g * .7152 + b * .0722) / 255;
    gray[pixel] = value; luminance += value;
  }
  const brightness = luminance / count;
  let variance = 0; let edge = 0; let blockEdge = 0; let ordinaryEdge = 0; let blockCount = 0; let ordinaryCount = 0;
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
    const position = y * frame.width + x; const value = gray[position];
    variance += (value - brightness) ** 2;
    if (x) {
      const delta = Math.abs(value - gray[position - 1]); edge += delta;
      if (x % 8 === 0) { blockEdge += delta; blockCount++; } else { ordinaryEdge += delta; ordinaryCount++; }
    }
    if (y) {
      const delta = Math.abs(value - gray[position - frame.width]); edge += delta;
      if (y % 8 === 0) { blockEdge += delta; blockCount++; } else { ordinaryEdge += delta; ordinaryCount++; }
    }
  }
  const contrast = Math.sqrt(variance / count);
  const sharpness = edge / Math.max(1, count * 2 - frame.width - frame.height);
  const blockiness = clamp01(Math.max(0, blockEdge / Math.max(1, blockCount) - ordinaryEdge / Math.max(1, ordinaryCount)) * 4);
  let hash = 0n;
  if (contrast > .000001) for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
    const x = Math.min(frame.width - 1, Math.floor((gx + .5) * frame.width / 8));
    const y = Math.min(frame.height - 1, Math.floor((gy + .5) * frame.height / 8));
    if (gray[y * frame.width + x] >= brightness) hash |= 1n << BigInt(gy * 8 + gx);
  }
  const qualityScore = clamp01(.4 * Math.min(1, contrast * 3) + .35 * Math.min(1, sharpness * 4) + .2 * (1 - Math.min(1, Math.abs(brightness - .5) * 2)) + .05 * (1 - blockiness));
  return {
    id: evidenceId('measurement', index + 1, frame.timeSec, undefined, sourceFingerprint), sourceFrameId: frame.id, timeSec: frame.timeSec,
    perceptualHash: hash.toString(16).padStart(16, '0'), brightness: round(brightness), contrast: round(contrast),
    sharpness: round(sharpness), blockiness: round(blockiness), visualChangeFromPrevious: 0,
    luminanceChangeFromPrevious: 0, edgeChangeFromPrevious: 0,
    color: [round(red / count / 255), round(green / count / 255), round(blue / count / 255)], qualityScore: round(qualityScore),
  };
}

function pixelDifference(a: PixelFrame, b: PixelFrame): number {
  if (a.width !== b.width || a.height !== b.height || a.pixels.length !== b.pixels.length) return 1;
  let total = 0;
  for (let index = 0; index < a.pixels.length; index += 4) total += Math.abs(a.pixels[index] - b.pixels[index]) + Math.abs(a.pixels[index + 1] - b.pixels[index + 1]) + Math.abs(a.pixels[index + 2] - b.pixels[index + 2]);
  return total / (a.width * a.height * 3 * 255);
}

function hamming(a: string, b: string): number {
  let value = BigInt(`0x${a}`) ^ BigInt(`0x${b}`); let count = 0;
  while (value) { count += Number(value & 1n); value >>= 1n; }
  return count;
}

function similarity(a: FrameMetrics, b: FrameMetrics): number {
  const hashSimilarity = 1 - hamming(a.perceptualHash, b.perceptualHash) / 64;
  const colorDistance = Math.sqrt(a.color.reduce((sum, value, index) => sum + (value - b.color[index]) ** 2, 0) / 3);
  return round(clamp01(hashSimilarity * .72 + (1 - colorDistance) * .28));
}

function activityWindow(kind: 'opening' | 'ending', rows: FrameMetrics[], startSec: number, endSec: number, sourceFingerprint: string): ActivityWindow {
  const changes = rows.map(row => row.visualChangeFromPrevious);
  const meanVisualChange = round(average(changes)); const maxVisualChange = round(Math.max(0, ...changes));
  return {
    id: evidenceId(kind, 1, startSec, endSec, sourceFingerprint), startSec: round(startSec, 3), endSec: round(endSec, 3),
    measurementIds: rows.map(row => row.id), meanVisualChange, maxVisualChange,
    activityLevel: meanVisualChange < .02 && maxVisualChange < .05 ? 'low' : meanVisualChange < .08 && maxVisualChange < .16 ? 'medium' : 'high',
  };
}

function technicalEvidence(rows: FrameMetrics[]): TechnicalEvidence {
  return {
    frameCount: rows.length,
    meanBrightness: round(average(rows.map(row => row.brightness))),
    meanContrast: round(average(rows.map(row => row.contrast))),
    meanSharpness: round(average(rows.map(row => row.sharpness))),
    meanBlockiness: round(average(rows.map(row => row.blockiness))),
    underexposedRatio: round(rows.filter(row => row.brightness < .08).length / rows.length),
    overexposedRatio: round(rows.filter(row => row.brightness > .92).length / rows.length),
    lowContrastRatio: round(rows.filter(row => row.contrast < .035).length / rows.length),
    lowSharpnessRatio: round(rows.filter(row => row.sharpness < .02).length / rows.length),
  };
}

export function unavailableAudioAnalysis(reason: string): AudioAnalysis {
  const unavailable = <T>(): EvidenceValue<T> => ({ state: 'unavailable', value: null, confidence: 'low', evidenceIds: [], provenance: 'measured_local', limitation: reason });
  return {
    version: ANALYZER_VERSION, trackState: 'unavailable', sampleRate: null, durationSeconds: null,
    onsetDelaySec: unavailable<number>(), envelope: [], silenceIntervals: [], changePoints: [],
    trailingSilenceCandidate: unavailable<boolean>(), activeAtCutoffCandidate: unavailable<boolean>(),
    provenance: 'measured_local', limitations: [reason, 'Unavailable audio is not evidence of silence.'],
  };
}

export function analyzeVisualFrames(frames: PixelFrame[], durationSeconds: number, sourceFingerprint: string): EvidenceAnalysis {
  validateFrames(frames, durationSeconds);
  if (!sourceFingerprint) throw new Error('A full-content fingerprint is required for stable evidence IDs.');
  const measured = frames.map((frame, index) => baseMetrics(frame, index, sourceFingerprint));
  for (let index = 1; index < measured.length; index++) {
    measured[index].visualChangeFromPrevious = round(pixelDifference(frames[index - 1], frames[index]));
    measured[index].luminanceChangeFromPrevious = round(Math.abs(measured[index].brightness - measured[index - 1].brightness));
    measured[index].edgeChangeFromPrevious = round(Math.abs(measured[index].sharpness - measured[index - 1].sharpness));
  }
  const changes = measured.slice(1).map(row => row.visualChangeFromPrevious);
  const midpoint = median(changes); const deviation = median(changes.map(value => Math.abs(value - midpoint)));
  const transitionThreshold = Math.min(.5, Math.max(.08, midpoint + Math.max(.04, deviation * 4)));
  const hardCutThreshold = Math.min(.75, Math.max(.16, transitionThreshold * 1.7));
  const starts = [0, ...measured.flatMap((row, index) => index > 0 && row.visualChangeFromPrevious >= transitionThreshold ? [index] : [])];
  const shots: ShotEvidence[] = starts.map((start, shotIndex) => {
    const next = starts[shotIndex + 1] ?? measured.length;
    const rows = measured.slice(start, next);
    const representative = [...rows].sort((a, b) => b.qualityScore - a.qualityScore || a.timeSec - b.timeSec)[0];
    const startSec = rows[0].timeSec; const endSec = starts[shotIndex + 1] === undefined ? durationSeconds : measured[starts[shotIndex + 1]].timeSec;
    const withinChanges = rows.slice(shotIndex === 0 ? 1 : 0).map(row => row.visualChangeFromPrevious).filter((_, index) => !(shotIndex > 0 && index === 0));
    const boundaryChange = rows[0].visualChangeFromPrevious;
    const kind = shotIndex === 0 ? 'start' : boundaryChange >= hardCutThreshold ? 'candidate_hard_cut' : 'candidate_transition';
    const confidence = shotIndex === 0 ? 1 : clamp01((boundaryChange - transitionThreshold) / Math.max(.01, 1 - transitionThreshold));
    return {
      id: evidenceId('shot', shotIndex + 1, startSec, endSec, sourceFingerprint), startSec: round(startSec, 3), endSec: round(endSec, 3), durationSec: round(endSec - startSec, 3),
      measurementIds: rows.map(row => row.id), representativeMeasurementId: representative.id, representativeFrameId: null,
      boundary: { kind, confidence: round(confidence), measurementId: rows[0].id },
      withinShotVisualChange: { mean: round(average(withinChanges)), max: round(Math.max(0, ...withinChanges)) },
      quality: { brightness: representative.brightness, contrast: representative.contrast, sharpness: representative.sharpness, blockiness: representative.blockiness },
      similarShotIds: [],
    };
  });
  const representatives = new Map(shots.map(shot => [shot.id, measured.find(row => row.id === shot.representativeMeasurementId)!]));
  const repeatedShotCandidates: RepeatedShotCandidate[] = [];
  for (let left = 0; left < shots.length; left++) for (let right = left + 1; right < shots.length; right++) {
    const value = similarity(representatives.get(shots[left].id)!, representatives.get(shots[right].id)!);
    if (value >= .92 && repeatedShotCandidates.length < 200) {
      if (shots[left].similarShotIds.length < 12) shots[left].similarShotIds.push(shots[right].id);
      if (shots[right].similarShotIds.length < 12) shots[right].similarShotIds.push(shots[left].id);
      repeatedShotCandidates.push({ id: evidenceId('repeat', repeatedShotCandidates.length + 1, shots[left].startSec, shots[right].endSec, sourceFingerprint), shotIds: [shots[left].id, shots[right].id], similarity: value, confidence: value >= .97 ? 'high' : 'medium', provenance: 'measured_local' });
    }
  }
  const openingRows = measured.filter(row => row.timeSec <= Math.min(3, durationSeconds));
  const endingStart = Math.max(0, durationSeconds - Math.max(1, durationSeconds * .1));
  const endingRows = measured.filter(row => row.timeSec >= endingStart);
  const startEndValue = similarity(measured[0], measured.at(-1)!);
  const firstFrame = { id: evidenceId('frame', 1, measured[0].timeSec, undefined, sourceFingerprint), measurementId: measured[0].id, timeSec: measured[0].timeSec };
  const endingFrame = { id: evidenceId('frame', 2, measured.at(-1)!.timeSec, undefined, sourceFingerprint), measurementId: measured.at(-1)!.id, timeSec: measured.at(-1)!.timeSec };
  return {
    version: ANALYZER_VERSION, schemaVersion: EVIDENCE_SCHEMA_VERSION, sourceFingerprint, provenance: 'measured_local',
    capabilities: capabilityReport({ audioDecode: false, ocr: false, localSemantics: false, remoteSemantics: false }),
    measurements: measured.map(({ color: _color, qualityScore: _qualityScore, ...row }) => row), shots, repeatedShotCandidates,
    firstFrame, endingFrame,
    opening: activityWindow('opening', openingRows, 0, Math.min(3, durationSeconds), sourceFingerprint),
    endingTail: activityWindow('ending', endingRows, endingStart, durationSeconds, sourceFingerprint),
    startEndSimilarity: { id: evidenceId('measurement', measured.length + 1, 0, durationSeconds, sourceFingerprint), state: 'observed', value: startEndValue, confidence: 'high', evidenceIds: [firstFrame.id, endingFrame.id], provenance: 'measured_local' },
    technical: technicalEvidence(measured), audio: unavailableAudioAnalysis('Audio analysis has not been attached to this visual result.'),
    text: { state: 'unavailable', version: 'ocr-interface-v1', detections: [], provenance: 'ocr_local', limitations: ['Local OCR is deferred to Phase 3; no text absence is inferred.'] },
    limitations: [
      'Visual change, stillness, similarity, and candidate boundaries are measurements rather than creative judgments.',
      'Perceptual similarity does not establish semantic redundancy or a seamless loop.',
      'Repeated-shot candidates are bounded to 200 pairs and 12 links per shot for debug and transport efficiency.',
      'Semantic meaning and rule applicability are deferred to Phase 3.',
    ],
  };
}

export function selectRepresentativeTimes(analysis: EvidenceAnalysis, durationSeconds: number, limit = 96): number[] {
  if (limit < 4) throw new Error('At least four representative frames are required.');
  const times = analysis.measurements.map(row => row.timeSec);
  const selected = new Set<number>();
  const nearest = (target: number) => times.reduce((best, time) => Math.abs(time - target) < Math.abs(best - target) ? time : best, times[0]);
  const add = (time: number) => { if (selected.size < limit) selected.add(time); };
  add(times[0]); add(times.at(-1)!);
  for (const target of [0, .1, .25, .5, .8, 1.2, 1.7, 2.3, 3].filter(time => time <= durationSeconds)) add(nearest(target));
  const baselineCount = Math.min(64, Math.max(32, Math.ceil(durationSeconds / .6) + 1));
  for (let index = 0; index < baselineCount; index++) add(nearest(durationSeconds * index / Math.max(1, baselineCount - 1)));
  for (const shot of [...analysis.shots.slice(1)].sort((a, b) => b.boundary.confidence - a.boundary.confidence || a.startSec - b.startSec)) {
    const index = analysis.measurements.findIndex(row => row.id === shot.boundary.measurementId);
    if (index > 0) add(analysis.measurements[index - 1].timeSec);
    add(analysis.measurements[index].timeSec);
  }
  for (const shot of analysis.shots) add(analysis.measurements.find(row => row.id === shot.representativeMeasurementId)!.timeSec);
  return [...selected].sort((a, b) => a - b);
}

export function analyzeAudioSamples(samples: Float32Array, sampleRate: number, sourceFingerprint: string): AudioAnalysis {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error('A valid audio sample rate is required.');
  if (!sourceFingerprint) throw new Error('A full-content fingerprint is required for stable audio evidence IDs.');
  const durationSeconds = samples.length / sampleRate;
  const windowSamples = Math.max(1, Math.round(sampleRate / 10));
  const envelope: AudioAnalysis['envelope'] = [];
  for (let start = 0; start < samples.length; start += windowSamples) {
    const end = Math.min(samples.length, start + windowSamples); let squares = 0; let peak = 0;
    for (let index = start; index < end; index++) { const value = Math.abs(samples[index]); squares += value * value; peak = Math.max(peak, value); }
    const startSec = start / sampleRate; const endSec = end / sampleRate; const rms = Math.sqrt(squares / Math.max(1, end - start));
    envelope.push({ id: evidenceId('audio_window', envelope.length + 1, startSec, endSec, sourceFingerprint), startSec: round(startSec, 3), endSec: round(endSec, 3), rms: round(rms), peak: round(peak), active: rms >= .005 });
  }
  const active = envelope.filter(window => window.active);
  const trackState: AudioAnalysis['trackState'] = active.length ? 'available' : 'absent';
  const silenceIntervals: AudioAnalysis['silenceIntervals'] = [];
  let silenceStart: number | null = null;
  envelope.forEach((window, index) => {
    if (!window.active && silenceStart === null) silenceStart = window.startSec;
    if ((window.active || index === envelope.length - 1) && silenceStart !== null) {
      const endSec = window.active ? window.startSec : window.endSec;
      if (endSec - silenceStart >= .3) silenceIntervals.push({ id: evidenceId('audio_silence', silenceIntervals.length + 1, silenceStart, endSec, sourceFingerprint), startSec: round(silenceStart, 3), endSec: round(endSec, 3), confidence: 'high' });
      silenceStart = null;
    }
  });
  const deltas = envelope.slice(1).map((window, index) => Math.abs(window.rms - envelope[index].rms));
  const middle = median(deltas); const threshold = Math.max(.025, middle + Math.max(.02, median(deltas.map(value => Math.abs(value - middle))) * 3));
  const changePoints = envelope.slice(1).flatMap((window, index) => {
    const magnitude = Math.abs(window.rms - envelope[index].rms);
    return magnitude >= threshold ? [{ id: evidenceId('audio_change', index + 1, window.startSec, undefined, sourceFingerprint), timeSec: window.startSec, magnitude: round(magnitude), confidence: magnitude >= threshold * 2 ? 'high' as const : 'medium' as const }] : [];
  });
  const onset = active[0];
  const observed = <T>(value: T, evidenceIds: string[]): EvidenceValue<T> => ({ state: 'observed', value, confidence: 'high', evidenceIds, provenance: 'measured_local' });
  const notObserved = <T>(limitation: string): EvidenceValue<T> => ({ state: 'not_observed', value: null, confidence: 'high', evidenceIds: envelope.map(window => window.id), provenance: 'measured_local', limitation });
  const finalSilence = silenceIntervals.at(-1);
  const trailing = trackState === 'available' && Boolean(finalSilence && Math.abs(finalSilence.endSec - durationSeconds) <= .101);
  const activeAtCutoff = trackState === 'available' && Boolean(envelope.at(-1)?.active);
  return {
    version: ANALYZER_VERSION, trackState, sampleRate, durationSeconds: round(durationSeconds, 3),
    onsetDelaySec: onset ? observed(onset.startSec, [onset.id]) : notObserved<number>('No active audio window was measured.'),
    envelope, silenceIntervals, changePoints,
    trailingSilenceCandidate: trackState === 'available' ? observed(trailing, finalSilence ? [finalSilence.id] : [envelope.at(-1)!.id]) : notObserved<boolean>('No active audio track was measured.'),
    activeAtCutoffCandidate: trackState === 'available' ? observed(activeAtCutoff, [envelope.at(-1)!.id]) : notObserved<boolean>('No active audio track was measured.'),
    provenance: 'measured_local',
    limitations: ['Audio activity and silence are level measurements, not judgments of dead time, music, speech, intent, or quality.', 'Activity at the final decoded window is only a cutoff candidate.'],
  };
}
