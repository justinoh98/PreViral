import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRealDeviceResult,
  detectSoftwareAdapter,
  selectSmolVlmDtype,
} from '../../evaluation/realDeviceFeasibility';

test('software adapter detection recognizes fallback flags and renderer names', () => {
  assert.equal(detectSoftwareAdapter({ description: 'Google SwiftShader' }, false), true);
  assert.equal(detectSoftwareAdapter({ vendor: 'Mesa', device: 'llvmpipe' }, false), true);
  assert.equal(detectSoftwareAdapter({ vendor: 'NVIDIA', architecture: 'Ada' }, true), true);
  assert.equal(detectSoftwareAdapter({ vendor: 'NVIDIA', architecture: 'Ada' }, false), false);
});

test('SmolVLM2 dtype uses q4f16 only when shader-f16 is exposed', () => {
  assert.equal(selectSmolVlmDtype(['timestamp-query', 'shader-f16']), 'q4f16');
  assert.equal(selectSmolVlmDtype(['timestamp-query']), 'q4');
});

test('real-device classification stays inconclusive without hardware acceleration', () => {
  assert.equal(classifyRealDeviceResult({
    hardwareEligible: false,
    loadMs: null,
    inferenceMs: [],
    outputs: [],
    peakMemoryDeltaBytes: null,
    maxMainThreadGapMs: null,
    error: null,
  }), 'INCONCLUSIVE — HARDWARE ACCELERATION NOT AVAILABLE');
});

test('real-device classification waits for two useful successful runs', () => {
  assert.equal(classifyRealDeviceResult({
    hardwareEligible: true,
    loadMs: 20_000,
    inferenceMs: [4_000],
    outputs: ['The first frame is red and the second frame changes to blue.'],
    peakMemoryDeltaBytes: 300_000_000,
    maxMainThreadGapMs: 120,
    error: null,
  }), null);
  assert.equal(classifyRealDeviceResult({
    hardwareEligible: true,
    loadMs: 20_000,
    inferenceMs: [4_000, 3_500],
    outputs: ['unrelated output', 'unrelated output'],
    peakMemoryDeltaBytes: 300_000_000,
    maxMainThreadGapMs: 120,
    error: null,
  }), 'NOT VIABLE');
});

test('real-device classification distinguishes viable and constrained hardware runs', () => {
  const base = {
    hardwareEligible: true,
    loadMs: 20_000,
    inferenceMs: [4_000, 3_500],
    outputs: [
      'The first frame is red and the second frame changes to blue.',
      'The image changes from red in the first frame to blue in the second.',
    ],
    peakMemoryDeltaBytes: 300_000_000,
    maxMainThreadGapMs: 120,
    error: null,
  };
  assert.equal(classifyRealDeviceResult(base), 'VIABLE');
  assert.equal(classifyRealDeviceResult({ ...base, inferenceMs: [18_000, 12_000] }), 'VIABLE WITH HIGH-TIER LIMITATIONS');
  assert.equal(classifyRealDeviceResult({ ...base, inferenceMs: [35_000, 31_000] }), 'NOT VIABLE');
});
