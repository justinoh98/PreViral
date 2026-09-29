/// <reference lib="webworker" />

import { AutoProcessor, AutoTokenizer, Florence2ForConditionalGeneration, type Florence2Processor, RawImage, SmolVLMForConditionalGeneration, Tensor, env } from '@huggingface/transformers';
import { runSemanticBenchmark, type BenchmarkFixture } from '../../evaluation/semanticBenchmark';
import { createVisualFeasibilityBenchmarkAdapter, FLORENCE2_BASE_FT_Q4_ARTIFACT, SMOLVLM2_Q4_ARTIFACT, SMOLVLM2_Q4F16_ARTIFACT, type VisualFeasibilityRuntime } from '../../evaluation/visualModelFeasibility';

type Provider = 'webgpu' | 'wasm';
type Dtype = 'q4f16' | 'q4';
type Model = 'smolvlm2' | 'florence2';
type Progress = { status?: string; file?: string; loaded?: number; total?: number; progress?: number };

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 1;

const fixture = (suffix: string): BenchmarkFixture => ({
  id: `two-frame-visual-probe-${suffix}`,
  source: { kind: 'synthetic', locator: `generated:phase-3a-two-frame-${suffix}` },
  frameCount: 2,
  referenceIds: { evidenceIds: [], frameIds: [], shotIds: [] },
  expectedObservations: [],
  language: 'not_applicable',
  scenario: 'standard',
  tags: ['unknown_calibration'],
});

const frames = () => {
  const width = 224; const height = 224; const length = width * height * 3;
  const first = new Uint8ClampedArray(length);
  const second = new Uint8ClampedArray(length);
  for (let index = 0; index < length; index += 3) {
    first[index] = 210; first[index + 1] = 35; first[index + 2] = 35;
    second[index] = 35; second[index + 1] = 75; second[index + 2] = 220;
  }
  return [new RawImage(first, width, height, 3), new RawImage(second, width, height, 3)];
};

const postProgress = (detail: unknown) => workerScope.postMessage({ type: 'progress', detail });

async function executeSmolVlm(provider: Provider, dtype: Dtype) {
  const artifact = dtype === 'q4' ? SMOLVLM2_Q4_ARTIFACT : SMOLVLM2_Q4F16_ARTIFACT;
  let model: SmolVLMForConditionalGeneration | null = null;
  let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null = null;
  const fileTotals = new Map<string, number>();
  const progress = (event: Progress) => {
    if (event.file && Number.isFinite(event.total)) fileTotals.set(event.file, event.total!);
    if (event.status === 'initiate' || event.status === 'ready' || event.status === 'done') postProgress({ provider, ...event });
  };
  const runtime: VisualFeasibilityRuntime = {
    load: async mode => {
      postProgress({ provider, stage: 'load', mode });
      fileTotals.clear();
      processor = await AutoProcessor.from_pretrained(artifact.id, { revision: artifact.revision, progress_callback: progress });
      model = await SmolVLMForConditionalGeneration.from_pretrained(artifact.id, {
        revision: artifact.revision,
        device: provider,
        dtype,
        session_options: { enableMemPattern: false },
        progress_callback: progress,
      }) as unknown as SmolVLMForConditionalGeneration;
      const loadedBytes = [...fileTotals.values()].reduce((sum, value) => sum + value, 0);
      return { downloadedBytes: mode === 'cold' ? loadedBytes : 0 };
    },
    infer: async input => {
      if (!model || !processor) throw new Error('SmolVLM2 must be loaded before inference.');
      const conversation = [{ role: 'user', content: [{ type: 'image' }, { type: 'image' }, { type: 'text', text: 'Describe the visible change between these two frames in one short sentence.' }] }];
      const prompt = processor.apply_chat_template(conversation, { add_generation_prompt: true }) as string;
      const inputs = await processor(prompt, frames(), { do_image_splitting: false });
      const generated = await model.generate({ ...inputs, max_new_tokens: 8, do_sample: false, repetition_penalty: 1.1 }) as Tensor;
      const promptLength = inputs.input_ids.dims.at(-1)!;
      const newTokens = generated.slice(null, [promptLength, null]);
      const decoded = processor.batch_decode(newTokens, { skip_special_tokens: true });
      return { text: decoded[0]?.trim() ?? '', frameCount: input.frameCount };
    },
    cleanup: async () => {
      if (model) await model.dispose();
      model = null; processor = null;
      postProgress({ provider, stage: 'cleanup', complete: true });
    },
  };
  const adapter = createVisualFeasibilityBenchmarkAdapter({ artifact, executionProvider: provider, requestedTier: 'high', maxFrames: 2, runtime });
  const result = await runSemanticBenchmark(adapter, [fixture('first'), fixture('repeat')], {
    environment: { platform: navigator.platform || 'browser', browser: navigator.userAgent, deviceClass: 'desktop' },
    memoryBytes: () => {
      const memory = performance as Performance & { memory?: { usedJSHeapSize?: number } };
      return Number.isFinite(memory.memory?.usedJSHeapSize) ? memory.memory!.usedJSHeapSize! : null;
    },
    memorySampleIntervalMs: 25,
  });
  return { provider, dtype, artifact, benchmark: result, diagnostics: adapter.diagnostics };
}

const florenceFixtures: BenchmarkFixture[] = [
  {
    id: 'florence-frame-car',
    source: { kind: 'local_file', locator: 'tests/media/local-benchmarks/florence2/car.jpg' },
    frameCount: 1,
    referenceIds: { evidenceIds: [], frameIds: [], shotIds: [] },
    expectedObservations: [],
    language: 'not_applicable',
    scenario: 'standard',
    tags: ['unknown_calibration'],
  },
  {
    id: 'florence-frame-cats',
    source: { kind: 'local_file', locator: 'tests/media/local-benchmarks/florence2/cats.png' },
    frameCount: 1,
    referenceIds: { evidenceIds: [], frameIds: [], shotIds: [] },
    expectedObservations: [],
    language: 'not_applicable',
    scenario: 'standard',
    tags: ['unknown_calibration'],
  },
];

async function executeFlorence(provider: Provider, dtype: Dtype) {
  if (dtype !== 'q4') throw new Error('Florence-2 Phase 3.3B is pinned to the q4 artifact.');
  const artifact = FLORENCE2_BASE_FT_Q4_ARTIFACT;
  let model: Florence2ForConditionalGeneration | null = null;
  let processor: Florence2Processor | null = null;
  let tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>> | null = null;
  const fileTotals = new Map<string, number>();
  const progress = (event: Progress) => {
    if (event.file && Number.isFinite(event.total)) fileTotals.set(event.file, event.total!);
    if (event.status === 'initiate' || event.status === 'ready' || event.status === 'done') postProgress({ model: 'florence2', provider, ...event });
  };
  const runtime: VisualFeasibilityRuntime = {
    load: async mode => {
      postProgress({ model: 'florence2', provider, stage: 'load', mode });
      fileTotals.clear();
      [processor, tokenizer, model] = await Promise.all([
        AutoProcessor.from_pretrained(artifact.id, { revision: artifact.revision, progress_callback: progress }) as Promise<Florence2Processor>,
        AutoTokenizer.from_pretrained(artifact.id, { revision: artifact.revision, progress_callback: progress }),
        Florence2ForConditionalGeneration.from_pretrained(artifact.id, {
          revision: artifact.revision,
          device: provider,
          dtype: { embed_tokens: dtype, vision_encoder: dtype, encoder_model: dtype, decoder_model_merged: dtype },
          session_options: { enableMemPattern: false },
          progress_callback: progress,
        }) as Promise<Florence2ForConditionalGeneration>,
      ]);
      const loadedBytes = [...fileTotals.values()].reduce((sum, value) => sum + value, 0);
      return { downloadedBytes: mode === 'cold' ? loadedBytes : 0 };
    },
    infer: async input => {
      if (!model || !processor || !tokenizer) throw new Error('Florence-2 must be loaded before inference.');
      const image = await RawImage.fromURL(new URL(`/${input.source.locator}`, workerScope.location.origin));
      const tasks = ['<MORE_DETAILED_CAPTION>', '<DENSE_REGION_CAPTION>'] as const;
      const outputs: Record<string, { latencyMs: number; result: unknown }> = {};
      for (const task of tasks) {
        const prompts = processor.construct_prompts(task);
        const inputs = await processor(image, prompts);
        const startedAt = performance.now();
        const generated = await model.generate({ ...inputs, max_new_tokens: task === '<MORE_DETAILED_CAPTION>' ? 64 : 96, do_sample: false, num_beams: 1 }) as Tensor;
        const latencyMs = performance.now() - startedAt;
        const decoded = tokenizer.batch_decode(generated, { skip_special_tokens: false })[0] ?? '';
        outputs[task] = { latencyMs, result: processor.post_process_generation(decoded, task, image.size) };
      }
      return { text: JSON.stringify({ frameId: input.id, imageSize: image.size, outputs }), frameCount: input.frameCount };
    },
    cleanup: async () => {
      if (model) await model.dispose();
      model = null; processor = null; tokenizer = null;
      postProgress({ model: 'florence2', provider, stage: 'cleanup', complete: true });
    },
  };
  const adapter = createVisualFeasibilityBenchmarkAdapter({
    artifact,
    executionProvider: provider,
    requestedTier: 'high',
    maxFrames: 1,
    runtime,
    benchmarkId: `${artifact.id}-phase-3b-feasibility`,
    benchmarkVersion: 'phase-3.3b-v1',
  });
  const result = await runSemanticBenchmark(adapter, florenceFixtures, {
    environment: { platform: navigator.platform || 'browser', browser: navigator.userAgent, deviceClass: 'desktop' },
    memoryBytes: () => {
      const memory = performance as Performance & { memory?: { usedJSHeapSize?: number } };
      return Number.isFinite(memory.memory?.usedJSHeapSize) ? memory.memory!.usedJSHeapSize! : null;
    },
    memorySampleIntervalMs: 25,
  });
  return {
    model: 'florence2',
    provider,
    dtype,
    artifact,
    frameSemantics: 'independent_frame_evidence_not_temporal_reasoning',
    benchmark: result,
    diagnostics: adapter.diagnostics,
  };
}

workerScope.onmessage = event => {
  if (event.data?.type !== 'run' || !['webgpu', 'wasm'].includes(event.data.provider) || !['q4f16', 'q4'].includes(event.data.dtype) || !['smolvlm2', 'florence2'].includes(event.data.model)) return;
  const execute = event.data.model === 'florence2' ? executeFlorence : executeSmolVlm;
  void execute(event.data.provider as Provider, event.data.dtype as Dtype).then(
    result => workerScope.postMessage({ type: 'result', result }),
    error => workerScope.postMessage({ type: 'error', error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }),
  );
};
