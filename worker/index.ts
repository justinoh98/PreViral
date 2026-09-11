import { evaluate } from '../evaluation/analyze';
import { EvaluationError } from '../evaluation/validation';
import { RUBRIC_VERSION, GROUNDING_VERSION } from '../evaluation/contracts';
import { ASSETS } from './assets';

type Env = { OPENAI_API_KEY?: string; OPENAI_MODEL?: string; ASSETS?: { fetch(request: Request): Promise<Response> } };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET') return json({ status: 'ok', service: 'previral-video-analysis' });
    if (url.pathname === '/api/evaluator-status' && request.method === 'GET') return json({ available: Boolean(env.OPENAI_API_KEY), provider: 'openai-api', rubricVersion: RUBRIC_VERSION, groundingVersion: GROUNDING_VERSION });
    if (url.pathname === '/api/evaluate-reel' && request.method === 'POST') {
      try {
        const body = await request.json();
        const result = await evaluate(body, env.OPENAI_API_KEY, env.OPENAI_MODEL || 'gpt-5.6-terra');
        return json(result);
      } catch (error) {
        const status = error instanceof EvaluationError ? error.status : 502;
        return json({ error: error instanceof EvaluationError ? error.code : 'AI_VIDEO_ANALYSIS_FAILED', message: error instanceof EvaluationError ? error.message : 'The video review did not finish. Please retry.', grounding: error instanceof EvaluationError ? error.grounding : undefined }, status);
      }
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    const asset = ASSETS[url.pathname] || (url.pathname === '/' ? ASSETS['/index.html'] : undefined);
    if (!asset) return new Response('Not found', { status: 404 });
    return new Response(asset.body, { headers: { 'content-type': asset.type, 'cache-control': 'public, max-age=31536000, immutable' } });
  },
};
