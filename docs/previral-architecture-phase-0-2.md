# PreViral source-reconciled architecture: Phases 0–2

Status: architecture approved; Phase 0–2 foundation implemented on `hermes/experimental`. Phase 3 semantic interpretation and rule activation are intentionally out of scope and remain unapproved.

## Authority and evidence hierarchy

1. Uploaded Reel evidence is the primary factual source: decoded chronology, visible content, locally detected text, measured audio activity, local transcript, and observed subjects/actions, each with provenance and confidence.
2. The exact selected Target Niche is audience context. It never establishes video facts and is never silently reclassified.
3. Filename, title, caption, manually supplied concept, creator identity, and other user metadata are optional context only.
4. The three unchanged PDFs in `docs/sources/` provide evaluation knowledge.
5. The deterministic PreViral engine remains the numerical score authority.

The normal public architecture is browser/local-first. Remote semantic providers are optional experimental or development adapters, not a required final public dependency. Phase 2 produces measurements only; it does not claim creative meaning.

## Canonical rubric boundary

The five aspects remain:

- Zero-Second Hook — 30%
- Pacing & Pattern Interrupts — 25%
- Narrative Arc & Payoff — 20%
- Loopability & Retention — 15%
- Technical & Unconnected Reach — 10%

Phase 0–2 do not change weights, qualitative anchors, caps, deductions, prediction arithmetic, or trait membership. The relationship among technical quality, non-follower accessibility, and shareability remains deferred to scoring reconciliation.

Successfully grounded evaluations continue to expose expected skip and follower/reach possibility estimates as heuristic outputs. Their range, confidence, and uncertainty changes belong to the later approved scoring-reconciliation phase; optional sub-indices may remain unavailable when unsupported.

## Phase 0: canonical source and rule specification

`evaluation/sourceRules.ts` is the machine-readable canonical registry. It records:

- the three approved source documents and page counts;
- page-level source provenance;
- deduplicated rule families;
- universal, conditional, and advisory classification;
- required evidence and allowed provenance;
- applicability conditions;
- confidence thresholds;
- possible severity;
- score-affecting versus feedback-only boundaries;
- strict-source exception fixtures.

Applicability has exactly three states: `applicable`, `not_applicable`, and `unknown`. Phase 0 defines this contract but does not implement final activation. A source sentence cannot directly create a penalty.

## Phase 1: local foundation

The local foundation provides:

- streaming, full-content SHA-256 identity independent of filename and media type;
- cache identity containing content, exact niche, optional context, language, and evidence/analyzer/source/rubric/prompt versions;
- stable evaluation and evidence IDs;
- explicit availability and unknown states;
- measured-local, OCR-local, transcript-local, semantic-local, and semantic-remote provenance contracts;
- capability reports that distinguish required, optional, and experimental extractors;
- bounded IndexedDB evaluation reuse.

A byte-level content change creates a fresh identity. An exact-content upload is eligible for stable reuse when its context and all version boundaries also match.

## Phase 2: deterministic media evidence

### Efficient whole-Reel decode

The browser performs one full-duration low-resolution measurement pass at 250 ms intervals, with 100 ms opening coverage through three seconds and explicit final-frame coverage. It retains only 48×48 measurement pixels during analysis. It then seeks only selected representative times for at most 96 higher-quality JPEG evidence frames.

The representative set prioritizes:

- actual first frame;
- dense opening evidence;
- both sides of high-confidence transition candidates;
- full-duration coverage;
- actual ending frame;
- shot representative measurements where budget permits.

Audio decoding runs in parallel where practical. The same `MediaEvidence` object is reused by downstream grounding and feedback; there is no second full-duration measurement pass.

### Visual measurements

The analyzer emits:

- actual first and ending evidence;
- dense timestamped measurements;
- candidate transitions and hard cuts;
- stable shot IDs, start, end, duration, and boundary confidence;
- within-shot visual-change summaries;
- representative measurement and frame IDs;
- perceptual hashes and start/end similarity;
- near-duplicate/repeated-shot candidates;
- opening and ending-tail activity;
- brightness, contrast, sharpness, and blockiness proxies;
- underexposure, overexposure, low-contrast, and low-sharpness ratios.

### Audio measurements

When browser decoding is available, the analyzer emits:

- track availability or measured absence;
- 100 ms RMS/peak activity envelope;
- onset delay;
- sustained silence intervals;
- level-change points;
- trailing-silence candidate;
- active-at-cutoff candidate.

Unavailable audio remains unavailable and is not converted to silence. Activity does not identify speech, music, beats, trend status, quality, or creative intent.

### Text interface

Phase 2 defines the versioned OCR result interface, bounds, timing, confidence, wording, and safe-zone overlap fields. OCR execution is deferred to Phase 3. Its capability is reported as unavailable, and no-text absence is not inferred.

### Semantic boundary

The following implications are forbidden in Phase 2:

- low motion → boring;
- silence → dead time;
- similarity → redundancy;
- start/end similarity → seamless loop;
- strongest technical candidate → payoff;
- frequent cuts → good pacing;
- long shot → poor pacing;
- absent OCR capability → no visible text.

## Debug visibility

Append `?previralDebug=1` to the application URL after running an evaluation. The local evidence panel exposes fingerprint, versions, capabilities, provenance, first/ending evidence, representative frame IDs/timestamps, all measurements, shots, boundary confidence, within-shot change, similarity and repetition candidates, opening and ending activity, audio evidence, text state, technical measurements, and limitations.

This is an opt-in diagnostic surface, not final product presentation.

## Deferred work

Phase 3 and later must not begin without approval. Deferred work includes semantic models, final applicability activation, scoring reconciliation, fifth-aspect trait changes, prediction-range changes, normal-public provider replacement, feedback restructuring, OCR execution, and Growth Playbook reconciliation.
