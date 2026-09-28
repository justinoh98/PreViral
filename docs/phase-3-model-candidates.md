# Phase 3.2 model candidate report

Status: candidates only. No model or inference dependency has been selected or installed. Sizes are the weight components expected to be loaded, not every alternative file in a repository. Memory figures are provisional engineering ranges except where a model card states otherwise; the Phase 3 benchmark harness must replace them with measured device results.

## Runtime candidates

- `@huggingface/transformers` 4.2.0: Apache-2.0, browser pipeline/runtime abstraction, WebGPU and ONNX Runtime Web WASM paths. Approximately 9.5 MB unpacked before ONNX Runtime and model assets.
- `onnxruntime-web` 1.29.0: MIT, WebGPU/WASM execution. Approximately 142 MB unpacked across distributed variants; production must use lazy backend-specific assets or a model-specific custom build rather than shipping every variant.
- Tesseract.js 7.0.0 / tesseract.js-core 6.1.2: Apache-2.0, browser WASM OCR worker. Approximately 1.4 MB wrapper and 30.6 MB unpacked core before language data.

These runtime versions are research references, not added dependencies.

## A. Visual embeddings

### CLIP ViT-B/32 — `Xenova/clip-vit-base-patch32`

- Model version reviewed: Hub revision `d15189d7028b43f1d3e65039190477f6af591c2a`.
- Purpose: visual embeddings, image clustering, bounded nearest-neighbor comparison, and closed-set image/text hypotheses.
- License: upstream OpenAI CLIP is MIT; the conversion repository does not publish explicit license metadata.
- Commercial-use status: conditional. Upstream terms permit commercial use, but the converted artifact's license chain and notices must be recorded before shipping.
- Approximate download size: 126 MB combined q4f16 or 153 MB int8; vision-only variants are approximately 53–89 MB but omit text hypotheses.
- Quantized options: q4, q4f16, int8/quantized, uint8, fp16, fp32.
- WebGPU support: supported by Transformers.js in principle; exact dtype/operator path must be benchmarked.
- WASM support: available through ONNX Runtime Web; expected to be slower but plausible with bounded batches.
- Expected memory: provisional 250–600 MB depending on dtype, batch, runtime copies, and whether both encoders are resident.
- Desktop feasibility: likely good on WebGPU; plausible on strong WASM desktops.
- Android feasibility: possible with strict batching and memory downgrade; not yet measured.
- iPhone/Safari feasibility: uncertain. WebGPU and ONNX operator behavior require real Safari/device tests; WASM fallback may be necessary.
- Language support: image/text training is primarily English-oriented.
- Korean support: not dependable for Korean text hypotheses. Internal English hypothesis labels could be used, but Korean OCR/transcript meaning requires separate models.
- Expected strengths: stable frame embeddings, similarity, clustering, candidate ranking, and small closed-set concepts.
- Expected weaknesses: no free-form action, temporal intent, joke, payoff, OCR, or narrative understanding; similarity cannot establish redundancy.
- Runtime/library required: Transformers.js plus ONNX Runtime Web.
- Self-hosting feasibility: good if the conversion license chain is cleared; assets can be revision-pinned and served from the PreViral origin.

Decision status: serious medium-tier candidate and optional high-tier support, not selected.

### SigLIP2 base screen-out

The reviewed int8 combined ONNX artifact is approximately 378 MB and q4f16 approximately 497 MB. That is materially larger than CLIP ViT-B/32 for the same supporting role. It is not a leading mandatory-public candidate unless a later accuracy benchmark shows a decisive gain or a smaller properly licensed variant is found.

## B. Object/subject understanding

### MobileNetV4 Conv Small — `onnx-community/mobilenetv4_conv_small.e2400_r224_in1k`

- Model version reviewed: Hub revision `3ba07f12712fa58fd6b3d661f9909c9e332c5005`.
- Purpose: low-cost object/category cues and a low-tier visual capability check.
- License: conversion repository has no explicit license metadata; upstream implementation/data terms require review.
- Commercial-use status: blocked pending an auditable model/license chain.
- Approximate download size: approximately 3.9 MB int8/quantized.
- Quantized options: int8, uint8, quantized, q4, fp16, fp32.
- WebGPU support: demonstrated as a Transformers.js WebGPU image-classification architecture.
- WASM support: expected through ONNX Runtime Web and practical at this size.
- Expected memory: provisional 50–150 MB including runtime and tensors.
- Desktop feasibility: high.
- Android feasibility: likely high, pending representative browser tests.
- iPhone/Safari feasibility: likely feasible through WASM; WebGPU path remains browser/version dependent.
- Language support: ImageNet labels are English strings.
- Korean support: no Korean semantic understanding; stable class IDs can be localized for display.
- Expected strengths: small, fast, broad common-object cues, useful low-tier smoke test.
- Expected weaknesses: ImageNet label restrictions, weak social-video specificity, no action/progression/payoff/intent reasoning.
- Runtime/library required: Transformers.js/ONNX Runtime Web or direct ONNX Runtime Web.
- Self-hosting feasibility: technically easy; legally gated by license-chain review.

Decision status: serious low-tier supporting candidate only, not selected.

Florence-2's grounded object-detection tasks are also a high-tier object candidate, but it should not be loaded in addition to another VLM unless measured gains justify the memory cost.

## C. Lightweight visual-language understanding

### SmolVLM2-256M-Video-Instruct — `HuggingFaceTB/SmolVLM2-256M-Video-Instruct`

- Model version reviewed: Hub revision `067788b187b95ebe7b2e040b3e4299e342e5b8fd`.
- Purpose: multi-frame/video description, subject/action comparison, temporal questions, and candidate progression/payoff interpretation.
- License: Apache-2.0.
- Commercial-use status: allowed under Apache-2.0, subject to notices and a final dependency/data review.
- Approximate download size: approximately 189 MB for q4f16 decoder, embeddings, and vision encoder; approximately 260 MB int8, plus tokenizer/configuration assets.
- Quantized options: bnb4, q4, q4f16, int8/quantized, uint8, fp16, fp32.
- WebGPU support: ONNX files exist, but the complete browser operator path is unproven and must pass the harness.
- WASM support: theoretically possible through ONNX Runtime; expected to be too slow or memory-heavy for a mandatory medium/low path.
- Expected memory: model card reports about 1.38 GB GPU RAM for video inference. Browser peak memory must be measured separately.
- Desktop feasibility: plausible high-tier candidate on capable WebGPU desktops.
- Android feasibility: doubtful as a mandatory path; test only on high-memory modern devices with aggressive frame limits.
- iPhone/Safari feasibility: uncertain and likely unsuitable as mandatory until WebGPU/operator/memory tests pass.
- Language support: model card identifies English.
- Korean support: unsupported for dependable reasoning/output. Korean OCR and ASR require separate extractors; internal facts may be localized only after validation.
- Expected strengths: trained for video/multi-image use, richer temporal queries than image-only models, smaller than many VLMs.
- Expected weaknesses: published 256M video benchmark performance trails larger variants; hallucination and nuanced intent remain risks; English-only; high browser memory.
- Runtime/library required: a Transformers.js version supporting its Idefics3-derived architecture plus ONNX Runtime Web, or a direct proven ONNX adapter.
- Self-hosting feasibility: good under Apache-2.0; approximately 200–300 MB initial asset delivery remains significant.

Decision status: leading high-tier bake-off candidate, not selected.

### Florence-2-base-ft — `onnx-community/Florence-2-base-ft`

- Model version reviewed: Hub revision `e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f`.
- Purpose: detailed frame captions, object detection, region grounding, and high-tier text/object corroboration.
- License: MIT.
- Commercial-use status: allowed under MIT, subject to notices and final artifact review.
- Approximate download size: approximately 223 MB q4f16; approximately 275 MB int8; common q4 component selection can reach about 333 MB, plus tokenizer/configuration assets.
- Quantized options: bnb4, q4, q4f16, int8/quantized, uint8, fp16, fp32.
- WebGPU support: a Transformers.js WebGPU demo exists.
- WASM support: operators may run through ONNX Runtime, but generative multi-frame use is expected to be impractical.
- Expected memory: provisional 800 MB–1.5 GB depending on quantization, decoder cache, and frame scheduling.
- Desktop feasibility: plausible high-tier WebGPU candidate.
- Android feasibility: limited; likely optional only on high-memory devices.
- iPhone/Safari feasibility: unproven and not suitable as mandatory without direct tests.
- Language support: multilingual behavior is not guaranteed by the model card.
- Korean support: must be benchmarked; do not depend on it for exact Korean text.
- Expected strengths: grounded objects/regions, detailed single-frame descriptions, existing browser demonstration.
- Expected weaknesses: image-oriented rather than video-trained; temporal meaning must be built by comparing frame outputs; generative cost and hallucination risk.
- Runtime/library required: Transformers.js plus ONNX Runtime Web.
- Self-hosting feasibility: good under MIT; asset size requires lazy versioned delivery.

Decision status: high-tier alternative to SmolVLM2 or targeted extractor, not selected. The initial stack should not load both VLMs.

## D. OCR

### Tesseract.js 7.0.0 with `tessdata_fast`

- Model/version reviewed: Tesseract.js 7.0.0, tesseract.js-core 6.1.2, current `tessdata_fast` English and Korean data.
- Purpose: local OCR wording, text presence, confidence, bounds, and repeated-frame persistence.
- License: Apache-2.0 for Tesseract.js/core and official trained data; retain required notices.
- Commercial-use status: allowed.
- Approximate download size: approximately 1.4 MB wrapper, 30.6 MB unpacked core, English data approximately 4.1 MB, Korean data approximately 1.7 MB. Compressed transfer must be measured in the actual build.
- Quantized options: traineddata fast/best trade-offs rather than neural integer quantization.
- WebGPU support: none required.
- WASM support: primary browser runtime.
- Expected memory: provisional 100–300 MB per worker/language depending on image size and outputs.
- Desktop feasibility: high with one reused worker.
- Android feasibility: likely practical with targeted crops and one language at a time.
- iPhone/Safari feasibility: likely practical through WASM; memory and worker lifecycle must be tested.
- Language support: more than 100 downloadable language packs.
- Korean support: yes through `kor.traineddata`.
- Expected strengths: mature local browser OCR, exact wording pathway, separate language assets, no server.
- Expected weaknesses: stylized, outlined, animated, perspective, tiny, or low-contrast social overlays; not a semantic reasoner.
- Runtime/library required: Tesseract.js/core WASM worker.
- Self-hosting feasibility: strong; runtime and selected traineddata can be served from the PreViral origin.

Decision status: leading OCR bake-off candidate, not installed or selected.

Florence-2 OCR can be compared as high-tier corroboration, but generative output may not replace exact-wording confidence and null-on-unreadable safeguards.

## E. ASR

### Whisper tiny multilingual — `onnx-community/whisper-tiny`

- Model version reviewed: Hub revision `ff4177021cc41f7db950912b73ea4fdf7d01d8e7`.
- Purpose: local speech transcription and timestamped transcript chunks.
- License: upstream Whisper is MIT; conversion repository lacks explicit license metadata.
- Commercial-use status: conditional pending recorded conversion license chain and notices.
- Approximate download size: approximately 41 MB int8 encoder plus merged decoder, plus tokenizer/configuration assets.
- Quantized options: int8/quantized, uint8, q4, bnb4, fp16, fp32. Some q4 exports are unexpectedly larger, so actual loaded components must be totaled.
- WebGPU support: Transformers.js documents Whisper WebGPU inference.
- WASM support: available in principle; bounded audio chunks and duration tests are required.
- Expected memory: provisional 150–400 MB including features, decoder state, runtime, and audio buffers.
- Desktop feasibility: likely good on WebGPU and acceptable on strong WASM.
- Android feasibility: plausible conditionally when Phase 2 finds active audio and the device passes memory probes.
- iPhone/Safari feasibility: uncertain on WebGPU; WASM may be viable with strict chunking.
- Language support: multilingual transcription and translation checkpoint.
- Korean support: included, but Korean word/character error rates must pass a dedicated benchmark.
- Expected strengths: compact multilingual ASR, established browser examples, no per-video API cost.
- Expected weaknesses: tiny-model transcription errors, names/slang/noisy music, imperfect timestamps; no music trend, sound-design, or intent understanding.
- Runtime/library required: Transformers.js plus ONNX Runtime Web.
- Self-hosting feasibility: good after license-chain confirmation.

Decision status: leading optional ASR candidate, not installed or selected. It should load only when Phase 2 audio activity makes speech analysis useful.

## F. Text/transcript embeddings

### Paraphrase Multilingual MiniLM-L12-v2 — `Xenova/paraphrase-multilingual-MiniLM-L12-v2`

- Model version reviewed: Hub revision `2c4055b12046f11709e9df2c122e59ffbdc2f900`.
- Purpose: align transcript/OCR chunks with promise, question, result, CTA, and explanation hypotheses.
- License: converted artifact has no explicit license metadata; upstream sentence-transformers license must be traced and recorded.
- Commercial-use status: conditional pending license-chain verification.
- Approximate download size: approximately 118 MB int8/quantized plus tokenizer; available q4 exports are not necessarily smaller.
- Quantized options: int8/quantized, uint8, q4, q4f16, bnb4, fp16, fp32.
- WebGPU support: feature extraction is supported by Transformers.js; exact model path must be tested.
- WASM support: expected through ONNX Runtime Web.
- Expected memory: provisional 200–500 MB including tokenizer/runtime/tensors.
- Desktop feasibility: likely good.
- Android feasibility: possible, but its 118 MB weight cost may not justify the narrow role.
- iPhone/Safari feasibility: unproven; likely WASM-capable with bounded text batches.
- Language support: multilingual 384-dimensional sentence embeddings.
- Korean support: expected from multilingual training but requires PreViral-specific semantic-alignment tests.
- Expected strengths: multilingual similarity and clustering of OCR/transcript chunks.
- Expected weaknesses: similarity is not reasoning or satisfaction; substantial extra download; cannot decide payoff by itself.
- Runtime/library required: Transformers.js plus ONNX Runtime Web.
- Self-hosting feasibility: technically easy after license clearance.

Decision status: optional only. Exclude it if the selected VLM/text encoder or lightweight lexical alignment achieves comparable applicability accuracy.

## Smallest-stack principle for the bake-off

The approved harness records immutable runtime/model revisions, checksums, licenses, loaded asset bytes, self-hosted versus local-fixture delivery, execution provider, browser/platform/device class, fixture language, and creative-exception status. It derives task correctness and observation-level denominators from benchmark-authored fixture truth rather than accepting candidate-reported scores or task labels. Failed fixtures remain in completion and correctness denominators, while empty expected-observation fixtures score a correct abstention. Memory is sampled periodically during load, inference, and cleanup and reported as an observed peak with its sampling interval, not as an absolute allocator peak. These fields make English/Korean, creative-exception, WebGPU/WASM, device-loss, and desktop/Android/iPhone completion runs comparable without installing a candidate in this phase. License clearance and delivery suitability still require human review of the recorded artifact manifests.

No stack is selected. Compare these bounded configurations:

1. High: SmolVLM2 OR Florence-2, plus Tesseract and conditional Whisper. Reuse the chosen VLM encoder where possible instead of loading CLIP and MiniLM too.
2. Medium: CLIP, Tesseract, and conditional Whisper. Add MiniLM only if measured semantic gains justify its 118 MB download.
3. Low: Phase 2 evidence plus a cleared MobileNetV4-class cue model and targeted Tesseract. Missing temporal/narrative semantics remain unknown.

Selection requires measured semantic correctness, creative-exception false-positive rates, English/Korean behavior, cold/warm load, per-frame and total latency, peak memory, device loss, WebGPU/WASM behavior, Android/iPhone completion, license clearance, and self-hosted asset delivery. No candidate may become mandatory merely because it has the strongest server-side benchmark score.

## Sources reviewed

- https://huggingface.co/docs/transformers.js/main/en/index
- https://onnxruntime.ai/docs/tutorials/web/
- https://huggingface.co/HuggingFaceTB/SmolVLM2-256M-Video-Instruct
- https://huggingface.co/onnx-community/Florence-2-base-ft
- https://huggingface.co/Xenova/clip-vit-base-patch32
- https://huggingface.co/onnx-community/whisper-tiny
- https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
- https://github.com/naptha/tesseract.js

No benchmark result is reported because no candidate model has been installed or run.
