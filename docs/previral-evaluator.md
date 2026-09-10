# PreViral evaluator: video grounding v2, unchanged creative rubric v1


## Local grounding update (v2)

The current pipeline is ordered adaptive images plus available speech -> factual inventory -> independent visual verification -> exact-niche interpretation -> unchanged deterministic scoring -> evidence-linked edit plan -> semantic feedback verification -> adapter/UI. The numerical rubric below is unchanged.

Run `npm run dev:codex` for the local Codex-backed evaluator. It uses the installed Codex CLI's existing ChatGPT sign-in, attaches the actual extracted images, and requests schema-constrained JSON. No API key is needed for this local visual review. Windows installations from the Codex app are discovered automatically; PREVIRAL_CODEX_EXECUTABLE can override the executable, and PREVIRAL_CODEX_MODEL can override the model. `npm run dev` keeps the existing OpenAI API provider. Production does not enable the local Codex provider. Neither command deploys or commits anything. The server remains bound to 0.0.0.0:3000; Codex-backed evaluation requests are accepted only from loopback.

The Codex subprocess is ephemeral and read-only, ignores user project configuration, disables shell/exec, apps, plugins, hooks, multi-agent, browser and other unrelated capabilities, and receives the prompt on stdin with image paths as separate arguments. Temporary images and schema/output files are deleted after each call. PreViral never reads account tokens or serves credentials to the browser. The reviewer uses account usage limits; a provider failure is an error, never a substitute score.

The local Codex path does not receive raw audio. If OPENAI_API_KEY is configured, the existing transcription service can provide speech; otherwise speech and all musical/sound-design claims remain unverified. Essential unavailable audio blocks a complete rating.

All ten exact canonical niche values are shared and validated. The factual inventory excludes category assumptions and is cached by evidence, language and versions. Audience interpretation explicitly receives the creator's exact niche; its separate cache includes niche. Changing audience cannot silently reuse another audience's judgments. Facts displayed in What I Saw are the verified inventory itself, not a new feedback-stage story.

Sampling preserves the original first-frame/dense-opening/full-duration coverage, reserves room for transition candidates, probes up to 240 small images, and sends at most 96 full-size images including both sides of selected changes. Pixel differences only select evidence; they never score pacing or creativity. Fixed sampling can still miss brief actions. Automatic reanalysis re-examines the same evidence once with specific failure reasons; it cannot recover an action that was never captured. Such gaps remain low confidence and require another export/upload, rather than invented observations.

Grounding HIGH requires specific supported content and sequence, all scenes corroborated, high reviewer/inventory confidence and no reported missing details. MEDIUM permits secondary uncertainties. LOW/FAILED blocks scoring and returns a partial, explicitly unverified inventory to the uploader. IDs, word count and scene count alone never confer confidence. A single continuous cinematic shot may cover opening through ending. Unsupported speech, invented scene IDs, duplicate corroboration and missing actual ending coverage are rejected. Independent model verification is not proof of factual accuracy; human-reviewed real-video acceptance remains required.

Every aspect carries source scenes and an audience-context interpretation. Every edit carries a separate problem target, existing sources or an explicit reshoot, and destination for move/replace/insert. Proposed copy is required where applicable. A semantic pass checks all major prose against the verified inventory, including generic English/Korean advice and implicit copy requests. One feedback repair is allowed. Checklist wording is derived from validated edits to prevent contradictory rewrites. What I Saw, aspect evidence and actual affected shots remain visible in the existing result design.

Regression tests include all ten niche values, cross-niche cache separation, contrasting observation fixtures, honest retry/failure, single-shot fairness, provenance, source/destination edits, deterministic scores and sampling boundaries. Synthetic image-sequence live Codex tests verify the model connection separately; they do not replace real-video tests across the ten niches. Full-video/audio understanding and real Instagram outcome calibration are not claimed.

## Source rubric

reference-old/server.ts defines the prompt rubric at line 303 and weighted calculation at line 700 (before this change). The original weights are Hook 30%, Pacing 25%, Narrative/Payoff 20%, Loop/Retention 15%, Technical 10%. The prior current server and localFallback used the same weights. The reference prompt called aspect five “Technical & Unconnected Reach”; the current implementation calls it “Technical Compliance & Safe Zone”. This implementation keeps current's five aspect keys and technical scope, with non-follower/share potential estimated separately. Visual interest is evidence for pacing and appeal, not a sixth aspect.

## Numerical rubric

All numerical rules live in evaluation/scoring.ts. Qualitative anchors: ineffective 0.5, weak 1.5, below_average 2.5, competent 3.2, strong 4.0, excellent 4.5, exceptional 4.8, outstanding 5.0. These are bounded judgments, not missing-data defaults. Each aspect averages its independent underlying judgments. A severe observed failure caps its aspect at 1.5; a major failure caps it at 2.5. Distinct minor weaknesses deduct 0.2 each, at most 0.4. Major/severe caps are used instead of repeating deductions already represented in qualitative judgment. One root cause belongs to one primary aspect. A score above 4.5 requires every contributing judgment to be exceptional/outstanding with high confidence. Exceptional judgments also require multiple supporting frame references. Do not reward technical polish as evidence for unrelated creative aspects.

The hook average uses first-frame attention, opening clarity, curiosity, anticipation. Pacing uses meaningful progression, experienced pacing and visual interest. Narrative uses setup and delivered payoff. Loop/retention uses satisfying ending and reason to replay (not obligatory matching start/end frames). Technical uses actual picture readability and visible text legibility; absent optional text is not penalized. Slow shots, missing optional CTAs, unknown audio and lack of fast cuts do not trigger mechanical penalties.

Aspect scores are rounded to one decimal before the single weighted overall calculation, which is rounded to one decimal. Overall percent is round(overallStars * 20). There is no independent overall cap/override. A severe hook cap limits an otherwise perfect Reel to 4.0 after rounding. Two distinct major retention caps prevent an excellent overall. Verdicts: >=4.4 Viral Contender, >=3.8 Strong Growth, >=3.0 Moderate Retention, otherwise High Skip Risk. These preserve existing UI enum values; “Viral Contender” is a qualitative rubric label, not guaranteed reach.

## Estimates

Skip risk combines hook risk 60%, progression/pacing risk 25% and payoff risk 15%. Map it to a heuristic midpoint from 10–90%, round to 5-point increments, and display a +/-15-point range (20 for medium-confidence review), bounded to 0–100. Severe opening failure forces midpoint >=65. This is NOT empirically calibrated Instagram data. It is a broad creative-risk estimate and must be presented as such.

Follow-conversion and sharing are 0–100 potential indices rounded to 5, not probabilities or future follower growth. Non-follower interest uses observed accessibility, curiosity, hook and visual appeal. Conversion uses observed reason to seek more, payoff and opening. Sharing uses observed sharing reason, payoff and replay. The adapter retains followerGrowthPotentialPercent for old consumers but new UI labels it /100. Legacy evaluations retain their original values and are flagged as different rubrics in history. No historical score is silently recalculated.

## Verification and deployment limits

Run npm test, npm run lint and npm run build. Regression cases cover the requested poor/weak/competent/strong/exceptional ranges, severe opening failure, repetitive beautiful footage, excellent hook with weak remainder, slow cinematic intrigue, meaningless fast cutting, unknown evidence, malformed provider output, grounded edit references, caching and deterministic arithmetic. Fixtures are conceptual, not substitutes for representative actual-video tests.

Hosting configuration is deliberately unchanged. The existing Sites configuration publishes only static Vite output; it cannot execute the Express evaluator. The existing Dockerfile also expects a server bundle not emitted by the current build script. A production AI endpoint/hosting correction needs separate approval. Do not publish static output as if it enables live AI evaluation.
