# Phase 3.3C — SmolVLM2 real-device feasibility result

Status: COMPLETE

Decision: **NOT VIABLE**

## Hardware and runtime

- GPU: Intel Gen-12LP WebGPU
- Hardware acceleration: eligible (`softwareDetected: false`)
- WebGPU feature: `shader-f16` available
- Selected quantization: `q4f16`
- Execution: local browser inference; model assets downloaded by the diagnostic runtime

## Observed result

| Measurement | Result |
| --- | ---: |
| Model load | 18.531 s |
| First inference | 4.880 s |
| Second/warm inference | 2.011 s |
| Total | 25.422 s |
| Error | none |

Both inference runs returned the same output:

```text
userid, andanotherwordorow
```

## Conclusion

Runtime performance on real hardware was sufficient to load the model and complete both bounded inference runs. The output did not identify or compare the red and blue frames and was nonsensical for the requested task. SmolVLM2 therefore fails the semantic-correctness gate and is **NOT VIABLE** for PreViral.

This result is not a Codespace-performance failure. Do not retest SmolVLM2. Preserve the Phase 3.3C diagnostic page and test infrastructure for provenance, but do not integrate SmolVLM2 into production semantic evaluation.

## Scope confirmation

- Deterministic scoring is unchanged.
- Provider behavior and provider selection are unchanged.
- No production semantic integration is included.
- Phase 3.4 has not started.
