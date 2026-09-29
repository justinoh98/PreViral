# Phase 3.3B Florence-2 feasibility result

Status: NOT VIABLE for the current browser-local high-tier path.

Scope: feasibility prototype only. No semantic inventory, rule applicability, scoring, provider, feedback, or Phase 3.4 integration.

## Artifact and license gate

- Browser artifact: `onnx-community/Florence-2-base-ft` at immutable revision `e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f`.
- Upstream: `microsoft/Florence-2-base-ft` at revision `f6c1a25888ffc1d945ee8a1a77ac833c7303d46e`.
- The converted repository declares `license: mit` and identifies the Microsoft checkpoint as its base model.[1]
- The upstream repository publishes the MIT license, which permits use, modification, distribution, sublicensing, and sale subject to preserving its notice.[2]
- Commercial use: permitted under the recorded MIT terms, subject to normal notice and dependency review.
- Browser runtime: Transformers.js `4.3.0`. The converted repository identifies Transformers.js and documents `Florence2ForConditionalGeneration`; the pinned runtime exports that architecture.[1]

The smallest repository option is q4f16, but it requires float16 support that the measured software WebGPU adapter did not expose. The tested all-q4 selection was therefore the smallest suitable selection for this environment. Its four ONNX components total 333,249,173 bytes; the repository manifest publishes each component size and SHA-256.[3]

## Tested workload

Two local, immutable frame fixtures were interpreted independently:

1. A turquoise car parked in front of a tan building with two brown doors.
2. Two tabby cats lying on a pink couch/blanket beside two remote controls.

Each frame ran `<MORE_DETAILED_CAPTION>` and `<DENSE_REGION_CAPTION>`. This tests frame-level evidence only. Florence-2 was not treated as a temporal or video model.

## Measured results

Environment: headless Chromium 141 on Linux x86_64 in Codespace. The WebGPU run explicitly used SwiftShader, so it is software-adapter evidence and does not predict hardware-GPU performance. Android, iPhone, and Safari remain UNVERIFIED.

### WebGPU q4

- Adapter/device creation: succeeded; `shader-f16` was not exposed.
- Model files loaded, but the bounded run produced no frame output before the 300,000 ms timeout.
- Peak Chromium process-tree RSS increase: 3,268,632,576 bytes.
- Timeout cancellation terminated the worker and left the page responsive.

### WASM q4

- Actual files loaded: 335,753,189 bytes.
- Cold load: 13,058.985 ms.
- Warm cached load: 3,676.335 ms.
- Two-frame inference total: 129,242.345 ms.
- Mean latency per independently interpreted frame: 64,621.173 ms.
- Peak Chromium process-tree RSS increase: 1,833,312,256 bytes.
- Both sequential frame runs completed; cleanup completed; a separate cancellation probe terminated the worker and left the page responsive.

## Output quality

The successful WASM path produced useful, specific frame evidence:

- Car frame caption: light-blue car parked in front of a tan building, two brown doors, facing left, black wheels.
- Car grounding: car and both wheels with bounding boxes.
- Cat frame caption: two brown/black cats lying on a pink blanket with two blue/white remote controls.
- Cat grounding: two cats with separate bounding boxes.

This is sufficiently specific for a later system to compare independently interpreted frames. It does not show that Florence-2 understands a video timeline.

## Decision

NOT VIABLE.

Semantic quality passed, but the tested browser-local runtime is not practical: software WebGPU failed to produce output within five minutes and reached about 3.27 GB additional process-tree RSS; WASM required about 64.6 seconds per frame and about 1.83 GB additional process-tree RSS. No claim is made about untested hardware WebGPU or mobile devices.

Gate summary:

- Exact artifact/revision: confirmed.
- License/commercial suitability: MIT; commercially suitable with notice and dependency review.
- Browser-compatible runtime: confirmed with Transformers.js `4.3.0`.
- WebGPU: adapter/device creation passed; frame inference failed to complete within 300,000 ms on software WebGPU.
- WASM: two sequential frame inferences succeeded.
- Grounding quality: useful captions and separate object bounding boxes on both fixtures.
- Multi-frame usefulness: useful for comparing independently interpreted frames; no temporal/video understanding demonstrated.
- Latency: 64,621.173 ms mean per frame on WASM; WebGPU exceeded the five-minute bound.
- Memory: 1,833,312,256-byte WASM and 3,268,632,576-byte WebGPU peak process-tree RSS increases.
- Worker stability: sequential WASM runs and cleanup completed; cancellation terminated the worker and left the page responsive on both tested paths.
- Mobile: UNVERIFIED.

## Sources

[1] Florence-2 browser artifact model card — https://huggingface.co/onnx-community/Florence-2-base-ft/raw/e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f/README.md
[2] Florence-2 upstream MIT license — https://huggingface.co/microsoft/Florence-2-base-ft/raw/f6c1a25888ffc1d945ee8a1a77ac833c7303d46e/LICENSE
[3] Florence-2 browser artifact file manifest — https://huggingface.co/api/models/onnx-community/Florence-2-base-ft/revision/e88a44eaf3791a35eae0c5a47b3dbcd36e67eb6f?blobs=true
