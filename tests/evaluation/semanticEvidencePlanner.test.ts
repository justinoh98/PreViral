import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeVisualFrames, selectRepresentativeTimes, type PixelFrame } from '../../evaluation/mediaAnalysis';
import type { Frame } from '../../evaluation/contracts';
import { planSemanticEvidence } from '../../src/evaluation/semantic/evidencePlanner';

const fingerprint = `sha256-${'c'.repeat(64)}`;
const pixelFrame = (id: string, timeSec: number, value: number): PixelFrame => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let i = 0; i < pixels.length; i += 4) { pixels[i] = value; pixels[i + 1] = (value * 3) % 255; pixels[i + 2] = 255 - value; pixels[i + 3] = 255; }
  return { id, timeSec, width: 8, height: 8, pixels };
};

function evidence(duration = 60, count = 61) {
  const pixels = Array.from({ length: count }, (_, index) => pixelFrame(`M${index}`, duration * index / (count - 1), index % 2 ? 230 : 20));
  const analysis = analyzeVisualFrames(pixels, duration, fingerprint);
  const frames: Frame[] = analysis.measurements.map((measurement, index) => ({ id: `FRAME_${index}`, timeSec: measurement.timeSec, imageUrl: 'data:image/jpeg;base64,YQ==' }));
  for (const shot of analysis.shots) {
    const measurement = analysis.measurements.find(row => row.id === shot.representativeMeasurementId)!;
    shot.representativeFrameId = frames.reduce((best, frame) => Math.abs(frame.timeSec - measurement.timeSec) < Math.abs(best.timeSec - measurement.timeSec) ? frame : best, frames[0]).id;
  }
  analysis.firstFrame.id = frames[0].id; analysis.endingFrame.id = frames.at(-1)!.id;
  analysis.startEndSimilarity.evidenceIds = [frames[0].id, frames.at(-1)!.id];
  return { analysis, frames };
}

test('planner uses Phase 2 structure across the complete Reel and records selection reasons', () => {
  const { analysis, frames } = evidence();
  const plan = planSemanticEvidence(analysis, frames, { maxFrames: 20, maxIntervals: 80 });
  assert.equal(plan.sourceFingerprint, fingerprint);
  assert.equal(plan.frames[0].frameId, frames[0].id);
  assert.ok(plan.frames.some(frame => frame.frameId === frames.at(-1)!.id));
  assert.ok(plan.frames.length <= 20);
  assert.deepEqual(plan.structuralCoverage.map(row => row.shotId), analysis.shots.map(shot => shot.id));
  assert.ok(plan.frames.some(frame => frame.selectionReasons.includes('opening')));
  assert.ok(plan.frames.some(frame => frame.selectionReasons.includes('representative_of_shot')));
  assert.ok(plan.frames.some(frame => frame.selectionReasons.includes('repetition_comparison')));
  assert.ok(plan.frames.some(frame => frame.selectionReasons.includes('high_visual_change')));
  assert.ok(plan.frames.some(frame => frame.selectionReasons.includes('transition_boundary')));
  assert.ok(plan.frames.some(frame => frame.selectionReasons.includes('potential_payoff')));
  assert.ok(plan.frames.some(frame => frame.selectionReasons.includes('actual_ending')));
  assert.ok(plan.frames.some(frame => frame.selectionReasons.includes('full_reel_coverage')));
  assert.ok(plan.frames.every(frame => frames.some(source => source.id === frame.frameId)));
  assert.deepEqual(planSemanticEvidence(analysis, frames, { maxFrames: 20, maxIntervals: 80 }), plan);
});

test('frame budget bounds expensive inference without truncating long-Reel structural coverage', () => {
  const { analysis, frames } = evidence(180, 181);
  const plan = planSemanticEvidence(analysis, frames, { maxFrames: 12, maxIntervals: 220 });
  assert.ok(plan.frames.length <= 12);
  assert.equal(plan.timeline.startSec, 0);
  assert.equal(plan.timeline.endSec, 180);
  assert.equal(plan.structuralCoverage.length, analysis.shots.length);
  assert.ok(plan.structuralCoverage.every(row => row.startSec >= 0 && row.endSec <= 180));
  assert.ok(plan.intervals.some(row => row.endSec === 180 && row.selectionReasons.includes('ending')));
  assert.ok(plan.unresolvedIntervals.length > 0);
  assert.ok(plan.unresolvedIntervals.every(row => row.selectionReasons.includes('unresolved_semantic_interval')));
  assert.ok(plan.frames.some(frame => frame.timeSec > 170));
  assert.ok(plan.frames.some(frame => frame.timeSec >= 72 && frame.timeSec <= 108 && frame.selectionReasons.includes('full_reel_coverage')));
});

test('planner rejects evidence that cannot prove actual first and ending coverage', () => {
  const { analysis, frames } = evidence(10, 11);
  assert.throws(() => planSemanticEvidence(analysis, frames.slice(1), { maxFrames: 8 }), /first frame/i);
  assert.throws(() => planSemanticEvidence(analysis, frames.slice(0, -1), { maxFrames: 8 }), /ending/i);
});

test('minimum frame budget still reserves timeline-spanning semantic evidence', () => {
  const { analysis, frames } = evidence(120, 121);
  const plan = planSemanticEvidence(analysis, frames, { maxFrames: 4, maxIntervals: 140 });
  assert.equal(plan.frames.length, 4);
  assert.ok(plan.frames.some(frame => frame.timeSec >= 30 && frame.timeSec <= 50));
  assert.ok(plan.frames.some(frame => frame.timeSec >= 70 && frame.timeSec <= 90));
});

test('the real Phase 2 frame cap cannot associate an out-of-shot frame with a short shot', () => {
  const duration = 100;
  const pixels = Array.from({ length: 401 }, (_, index) => pixelFrame(`M${index}`, duration * index / 400, index % 2 ? 230 : 20));
  const analysis = analyzeVisualFrames(pixels, duration, fingerprint);
  const retainedFrames: Frame[] = selectRepresentativeTimes(analysis, duration, 96).map((timeSec, index) => ({ id: `FRAME_${index}`, timeSec, imageUrl: 'data:image/jpeg;base64,YQ==' }));
  for (const shot of analysis.shots) {
    const measurement = analysis.measurements.find(row => row.id === shot.representativeMeasurementId)!;
    shot.representativeFrameId = retainedFrames.reduce((best, frame) => Math.abs(frame.timeSec - measurement.timeSec) < Math.abs(best.timeSec - measurement.timeSec) ? frame : best, retainedFrames[0]).id;
  }
  analysis.firstFrame.id = retainedFrames[0].id; analysis.endingFrame.id = retainedFrames.at(-1)!.id;
  const plan = planSemanticEvidence(analysis, retainedFrames, { maxFrames: 16, maxIntervals: 96 });
  const unresolvedWithoutFrame = plan.unresolvedIntervals.find(interval => interval.frameIds.length === 0)!;
  const coverage = plan.structuralCoverage.find(row => row.shotId === unresolvedWithoutFrame.shotIds[0])!;
  assert.equal(retainedFrames.length, 96);
  assert.equal(coverage.representativeFrameId, null);
  assert.equal(coverage.selectedForInference, false);
});
