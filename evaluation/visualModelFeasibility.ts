import type { BenchmarkAdapter, BenchmarkFixture, BenchmarkModelArtifact } from './semanticBenchmark';
import type { CapabilityTier, LocalExecutionProvider } from './contracts';

export type BrowserArtifactLicenseState = 'verified' | 'unverified';
export type VisualModelArtifact = {
  id: string;
  revision: string;
  upstreamLicense: string;
  browserArtifactLicense: BrowserArtifactLicenseState;
  browserArtifactLicenseName?: string;
  weightBytes: number;
  approximateTotalBytes: number;
  compositeChecksum: string;
  components: Array<{ path: string; bytes: number; sha256: string }>;
  tokenizerAndConfigFiles: string[];
  blocker?: string;
};

export const SMOLVLM2_Q4F16_ARTIFACT: VisualModelArtifact = Object.freeze({
  id: 'HuggingFaceTB/SmolVLM2-256M-Video-Instruct',
  revision: '067788b187b95ebe7b2e040b3e4299e342e5b8fd',
  upstreamLicense: 'Apache-2.0',
  browserArtifactLicense: 'verified',
  weightBytes: 189_174_979,
  approximateTotalBytes: 194_029_565,
  compositeChecksum: 'sha256-8b1b9904989433357eead6869cc8e726b1dc7f4bd77f935b54b70c4203cee63d',
  components: [
    { path: 'onnx/decoder_model_merged_q4f16.onnx', bytes: 77_366_473, sha256: '6c9032242ea8d440e6d53f31e7a1216cf94a98b5b909b1a718d68dc2983c0398' },
    { path: 'onnx/embed_tokens_q4f16.onnx', bytes: 56_770_965, sha256: 'f70ed24f9f21e0d9999151282aef893861bf08f96b5ad1658fb71ffd51e26784' },
    { path: 'onnx/vision_encoder_q4f16.onnx', bytes: 55_037_541, sha256: 'e0b4747edcc23de250266264ce8e5cb3e010cf80755933efca7052da53871818' },
  ],
  tokenizerAndConfigFiles: ['added_tokens.json', 'chat_template.json', 'config.json', 'generation_config.json', 'merges.txt', 'preprocessor_config.json', 'processor_config.json', 'special_tokens_map.json', 'tokenizer.json', 'tokenizer_config.json', 'vocab.json'],
});

export const SMOLVLM2_Q4_ARTIFACT: VisualModelArtifact = Object.freeze({
  id: 'HuggingFaceTB/SmolVLM2-256M-Video-Instruct',
  revision: '067788b187b95ebe7b2e040b3e4299e342e5b8fd',
  upstreamLicense: 'Apache-2.0',
  browserArtifactLicense: 'verified',
  weightBytes: 264_221_217,
  approximateTotalBytes: 269_075_803,
  compositeChecksum: 'sha256-ebbd434e579ec5f250a288d1e30c27d47bf772ea98d45be9faea2fcc549c879f',
  components: [
    { path: 'onnx/decoder_model_merged_q4.onnx', bytes: 86_894_835, sha256: 'ce4021b8e2242cbd4caac06b259e1b15e085c6a4b900af40f1e0abec7a6c6df2' },
    { path: 'onnx/embed_tokens_q4.onnx', bytes: 113_541_438, sha256: '64f62db97ca38a44b5ed8a225b75dbede2d069c9afc76696d63b89300d5edcd2' },
    { path: 'onnx/vision_encoder_q4.onnx', bytes: 63_784_944, sha256: '253d225bf96b6203118d16e57bb2890c2dc542dd989d484cb9541dc4d4ae719b' },
  ],
  tokenizerAndConfigFiles: ['added_tokens.json', 'chat_template.json', 'config.json', 'generation_config.json', 'merges.txt', 'preprocessor_config.json', 'processor_config.json', 'special_tokens_map.json', 'tokenizer.json', 'tokenizer_config.json', 'vocab.json'],
});

export const CLIP_VIT_B32_ARTIFACT: VisualModelArtifact = Object.freeze({
  id: 'Xenova/clip-vit-base-patch32',
  revision: 'd15189d7028b43f1d3e65039190477f6af591c2a',
  upstreamLicense: 'MIT',
  browserArtifactLicense: 'unverified',
  weightBytes: 125_818_295,
  approximateTotalBytes: 129_435_652,
  compositeChecksum: 'sha256-e8847d2c0927d97425c7941e50086f8f97cfe097a4d7cabfe7d63568a67c24c5',
  components: [{ path: 'onnx/model_q4f16.onnx', bytes: 125_818_295, sha256: '0fa5651801a45889d15576d445b23172f706be5b5d17f6d96a61b486cf4a5252' }],
  tokenizerAndConfigFiles: ['config.json', 'merges.txt', 'preprocessor_config.json', 'special_tokens_map.json', 'tokenizer.json', 'tokenizer_config.json', 'vocab.json'],
  blocker: 'The converted artifact license is not published in the candidate repository.',
});

export const FLORENCE2_BASE_FT_Q4_ARTIFACT: VisualModelArtifact = Object.freeze({
  id: 'onnx-community/Florence-2-base-ft',
  revision: 'e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f',
  upstreamLicense: 'MIT',
  browserArtifactLicense: 'verified',
  browserArtifactLicenseName: 'MIT',
  weightBytes: 333_249_173,
  approximateTotalBytes: 337_478_428,
  compositeChecksum: 'sha256-8b356dce7784cee2d7d9bfe54b692ef50cc149dfd315942924150f77061f0564',
  components: [
    { path: 'onnx/decoder_model_merged_q4.onnx', bytes: 64_393_474, sha256: 'be7a2f33e65f8d65538024772fda4d1c5a7752d60a7159aadf53f9f4798b90fa' },
    { path: 'onnx/embed_tokens_q4.onnx', bytes: 157_560_063, sha256: 'f972f338dedea6b67e10e87aacc0dfd4e247f1e18c60d3911af9e6b9edb68f32' },
    { path: 'onnx/encoder_model_q4.onnx', bytes: 30_058_778, sha256: '34b17bcf191dacb79bd482b94bad5cf1ba39bc770f6a4c9ae26f28b89c235e4b' },
    { path: 'onnx/vision_encoder_q4.onnx', bytes: 81_236_858, sha256: '8f211dfc176996d14e24d551f8e02530de781dd8b30d9e7d35b69b7c2d0340ce' },
  ],
  tokenizerAndConfigFiles: ['added_tokens.json', 'config.json', 'generation_config.json', 'merges.txt', 'preprocessor_config.json', 'special_tokens_map.json', 'tokenizer.json', 'tokenizer_config.json', 'vocab.json'],
});

export type VisualFeasibilityRuntime = {
  load: (mode: 'cold' | 'warm', signal: AbortSignal) => Promise<{ downloadedBytes: number }>;
  infer: (fixture: BenchmarkFixture, signal: AbortSignal) => Promise<{ text: string; frameCount: number }>;
  cleanup: () => Promise<void>;
};

export type VisualFeasibilityBenchmarkAdapter = BenchmarkAdapter & {
  cancel: () => void;
  diagnostics: {
    loads: Array<{ mode: 'cold' | 'warm'; downloadedBytes: number }>;
    outputs: Array<{ fixtureId: string; text: string; frameCount: number }>;
  };
};

type VisualFeasibilityAdapterOptions = {
  artifact: VisualModelArtifact;
  executionProvider: Exclude<LocalExecutionProvider, 'none'>;
  requestedTier: CapabilityTier;
  maxFrames: number;
  runtime: VisualFeasibilityRuntime;
  benchmarkId?: string;
  benchmarkVersion?: string;
};

const modelManifest = (artifact: VisualModelArtifact, executionProvider: Exclude<LocalExecutionProvider, 'none'>): BenchmarkModelArtifact => ({
  id: artifact.id,
  revision: artifact.revision,
  checksum: artifact.compositeChecksum,
  license: artifact.upstreamLicense,
  assetBytes: artifact.approximateTotalBytes,
  delivery: 'self_hosted',
});

export function createVisualFeasibilityBenchmarkAdapter(options: VisualFeasibilityAdapterOptions): VisualFeasibilityBenchmarkAdapter {
  if (options.artifact.browserArtifactLicense !== 'verified') throw new Error(options.artifact.blocker ?? 'Browser artifact license is unverified.');
  if (!Number.isInteger(options.maxFrames) || options.maxFrames < 1) throw new Error('A positive visual feasibility frame budget is required.');
  let controller = new AbortController();
  const diagnostics: VisualFeasibilityBenchmarkAdapter['diagnostics'] = { loads: [], outputs: [] };
  return {
    id: options.benchmarkId ?? `${options.artifact.id}-phase-3a-feasibility`,
    version: options.benchmarkVersion ?? 'phase-3.3a-v1',
    executionProvider: options.executionProvider,
    runtime: { id: '@huggingface/transformers', version: '4.3.0' },
    models: [modelManifest(options.artifact, options.executionProvider)],
    requestedTier: options.requestedTier,
    diagnostics,
    load: async mode => {
      controller = new AbortController();
      const result = await options.runtime.load(mode, controller.signal);
      diagnostics.loads.push({ mode, downloadedBytes: result.downloadedBytes });
    },
    infer: async fixture => {
      if (fixture.frameCount > options.maxFrames) throw Object.assign(new Error(`Visual feasibility frame budget exceeded: ${fixture.frameCount} > ${options.maxFrames}.`), { code: 'frame_budget_exceeded' });
      const result = await options.runtime.infer(fixture, controller.signal);
      if (!result.text.trim() || result.frameCount !== fixture.frameCount) throw Object.assign(new Error('Visual feasibility inference returned an invalid result.'), { code: 'invalid_visual_output' });
      diagnostics.outputs.push({ fixtureId: fixture.id, text: result.text, frameCount: result.frameCount });
      return { capabilityTier: options.executionProvider === 'webgpu' ? 'high' : 'medium', confidence: 1, observations: [] };
    },
    cleanup: async () => {
      controller.abort();
      await options.runtime.cleanup();
    },
    cancel: () => controller.abort(),
  };
}
