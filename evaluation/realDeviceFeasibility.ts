export type SmolVlmDtype = 'q4f16' | 'q4';
export type RealDeviceDecision = 'VIABLE' | 'VIABLE WITH HIGH-TIER LIMITATIONS' | 'NOT VIABLE' | 'INCONCLUSIVE — HARDWARE ACCELERATION NOT AVAILABLE';

export type RealDeviceRunSummary = {
  hardwareEligible: boolean;
  loadMs: number | null;
  inferenceMs: number[];
  outputs: string[];
  peakMemoryDeltaBytes: number | null;
  maxMainThreadGapMs: number | null;
  error: string | null;
};

const SOFTWARE_RENDERER_MARKERS = ['swiftshader', 'llvmpipe', 'lavapipe', 'software', 'basic render driver', 'fallback'];
const GIB = 1024 ** 3;

export function detectSoftwareAdapter(info: Record<string, unknown>, isFallbackAdapter: boolean | undefined): boolean {
  if (isFallbackAdapter === true) return true;
  const description = Object.values(info).filter(value => typeof value === 'string').join(' ').toLowerCase();
  return SOFTWARE_RENDERER_MARKERS.some(marker => description.includes(marker));
}

export function selectSmolVlmDtype(features: Iterable<string>): SmolVlmDtype {
  return new Set(features).has('shader-f16') ? 'q4f16' : 'q4';
}

function hasUsefulTwoFrameOutput(output: string): boolean {
  const normalized = output.toLowerCase();
  const identifiesRed = /\b(red|crimson|scarlet)\b/.test(normalized);
  const identifiesBlue = /\b(blue|navy|azure)\b/.test(normalized);
  const comparesFrames = /\b(change|changes|changed|different|first|second|frame|image|then|to)\b/.test(normalized);
  return identifiesRed && identifiesBlue && comparesFrames;
}

export function classifyRealDeviceResult(summary: RealDeviceRunSummary): RealDeviceDecision | null {
  if (!summary.hardwareEligible) return 'INCONCLUSIVE — HARDWARE ACCELERATION NOT AVAILABLE';
  if (summary.error) return 'NOT VIABLE';
  if (summary.inferenceMs.length < 2 || summary.outputs.length < 2) return null;
  if (!summary.outputs.slice(0, 2).every(hasUsefulTwoFrameOutput)) return 'NOT VIABLE';

  const [firstInferenceMs, warmInferenceMs] = summary.inferenceMs;
  if (
    summary.loadMs === null
    || summary.loadMs > 180_000
    || firstInferenceMs > 60_000
    || warmInferenceMs > 30_000
    || (summary.peakMemoryDeltaBytes !== null && summary.peakMemoryDeltaBytes > 2 * GIB)
    || (summary.maxMainThreadGapMs !== null && summary.maxMainThreadGapMs > 2_000)
  ) return 'NOT VIABLE';

  if (
    summary.loadMs > 60_000
    || firstInferenceMs > 20_000
    || warmInferenceMs > 10_000
    || summary.peakMemoryDeltaBytes === null
    || summary.peakMemoryDeltaBytes > GIB
    || summary.maxMainThreadGapMs === null
    || summary.maxMainThreadGapMs > 500
  ) return 'VIABLE WITH HIGH-TIER LIMITATIONS';

  return 'VIABLE';
}
