import { GROUNDING_VERSION, type VideoInventory, type Interpretation, type GroundingReport } from './contracts';
import { validateRequest, EvaluationError } from './validation';
import { INVENTORY_PROMPT, VERIFY_INVENTORY_PROMPT, PROMPT_VERSION } from './prompts';
import { callStructured, transcribe } from './provider';
import { scoreObservations } from './scoring';
import { explain } from './feedback';
import { adaptEvaluation } from './adapter';
import { evidenceKey, EvaluationCache } from './cache';
import { inventorySchema, verificationSchema, validateInventory, groundingReport, imageContent } from './grounding';
import { interpret } from './interpret';

const inventoryCache = new EvaluationCache<{ inventory: VideoInventory; transcript: string; grounding: GroundingReport }>();
const interpretationCache = new EvaluationCache<Interpretation>();
export async function evaluate(raw: unknown, apiKey: string | undefined, model: string, dependencies = { call: callStructured, transcribe, explain }) {
  const request = validateRequest(raw);
  if (!apiKey) throw new EvaluationError('AI_VIDEO_ANALYSIS_UNAVAILABLE', 'Video analysis is not connected on this server. No substitute rating has been generated.', 503);
  // Facts are audience-independent; language is included because facts are displayed verbatim.
  const key = [evidenceKey(request.evidence, model), request.language, GROUNDING_VERSION].join(':');
  let cached = inventoryCache.get(key);
  const hit = Boolean(cached);
  if (!cached) {
    let transcript = '';
    let speechFailure = '';
    if (request.evidence.audioWav) {
      try { transcript = await dependencies.transcribe(apiKey, request.evidence.audioWav); }
      catch { speechFailure = request.language === 'ko' ? '음성 전사를 완료하지 못했습니다.' : 'Speech transcription could not be completed.'; }
    }
    const media = imageContent(request.evidence);
    const metadata = { language: request.language, durationSeconds: request.evidence.durationSeconds, transcript: transcript || null, audioStatus: request.evidence.audioStatus, audioUnavailableReason: request.evidence.audioUnavailableReason || speechFailure || null };
    let inventory: VideoInventory | null = null;
    let report: GroundingReport = { version: GROUNDING_VERSION, targetNiche: request.niche, status: 'FAILED', inventory: null, issues: [], attempts: 0, verifiedSceneIds: [] };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const content = [{ type: 'input_text', text: JSON.stringify({ ...metadata, repairIssues: report.issues, previousInventory: inventory }) }, ...media];
        const candidate = await dependencies.call(apiKey, model, INVENTORY_PROMPT, content, inventorySchema, 'previral_inventory');
        inventory = validateInventory(candidate, request.evidence, transcript);
        const verified = await dependencies.call(apiKey, model, VERIFY_INVENTORY_PROMPT, [{ type: 'input_text', text: JSON.stringify({ ...metadata, inventory }) }, ...media], verificationSchema, 'previral_inventory_check');
        report = groundingReport(inventory, verified, request.niche, attempt);
        if (speechFailure) report.issues.push(speechFailure);
        if (report.status === 'HIGH' || report.status === 'MEDIUM') {
          cached = { inventory, transcript, grounding: report };
          inventoryCache.set(key, cached);
          break;
        }
      } catch (error) {
        if (!(error instanceof EvaluationError) || error.status >= 500) throw error;
        report = { ...report, status: inventory ? 'LOW' : 'FAILED', inventory, issues: [error.message], attempts: attempt, verifiedSceneIds: [] };
      }
    }
    if (!cached) throw new EvaluationError('INSUFFICIENT_GROUNDING', request.language === 'ko' ? '영상 내용을 충분히 확인하지 못해 점수를 매기지 않았습니다. 아래 관찰 내용을 확인하고 다시 시도해 주세요.' : 'The footage could not be understood reliably enough to score. Review What I Saw below and retry with a clearer export.', 422, report);
  }
  const grounding = { ...cached.grounding, targetNiche: request.niche };
  const interpretationKey = [key, request.niche, PROMPT_VERSION].join(':');
  let interpreted = interpretationCache.get(interpretationKey);
  try {
    if (!interpreted) {
      interpreted = await interpret(apiKey, model, cached.inventory, request.evidence, request.niche, cached.transcript, grounding, request.language, dependencies.call);
      interpretationCache.set(interpretationKey, interpreted);
    }
    const scores = scoreObservations(interpreted.observations);
    const context = { grounding, aspectContext: interpreted.aspectContext };
    const feedback = await dependencies.explain(apiKey, model, structuredClone(interpreted.observations), structuredClone(scores), request, context);
    const result = adaptEvaluation(request, interpreted.observations, scores, feedback, 'eval-' + crypto.randomUUID(), Boolean(cached.transcript), context);
    return { ...result, isCachedEvaluation: hit };
  } catch (error) {
    if (error instanceof EvaluationError && error.status === 422) {
      error.grounding = { ...grounding, issues: [...grounding.issues, error.message] };
      if (error.code === 'INSUFFICIENT_EVIDENCE' || error.code === 'UNGROUNDED_ANALYSIS') error.grounding.status = 'LOW';
    }
    throw error;
  }
}
