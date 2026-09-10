import express from 'express';
import path from 'path';
import { evaluate } from './evaluation/analyze';
import { EvaluationError } from './evaluation/validation';
import { RUBRIC_VERSION, GROUNDING_VERSION } from './evaluation/contracts';
import { responseText } from './evaluation/provider';
import { transcribe } from './evaluation/provider';
import { explain } from './evaluation/feedback';
import { codexAvailable, callCodexStructured } from './evaluation/codexProvider';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config({ path: '.env.local' });
dotenv.config();

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra';
// Explicit development-only option; production hosting and its default provider are unchanged.
const USE_LOCAL_CODEX = process.env.NODE_ENV !== 'production' && process.env.PREVIRAL_PROVIDER === 'codex';
const CODEX_MODEL = process.env.PREVIRAL_CODEX_MODEL || OPENAI_MODEL;

async function startServer() {
  const app = express();
  // Hosted platforms provide their own port through PORT; use 3000 only locally.
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware for large JSON payloads (for base64 frame snapshots)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // The Responses API is used directly so this server has no browser-side API key exposure.
  const getOpenAIApiKey = () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY is missing. Using fallback response generator.');
      return null;
    }
    return apiKey;
  };

  const createOpenAIResponse = async (apiKey: string, input: unknown) => {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input,
        store: false,
        reasoning: { effort: 'low' },
        text: { format: { type: 'json_object' }, verbosity: 'medium' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Responses API failed (${response.status}): ${await response.text()}`);
    }

    return JSON.parse(responseText(await response.json()));
  };

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/evaluator-status', async (_req, res) => {
    res.json({ available: USE_LOCAL_CODEX ? await codexAvailable() : Boolean(process.env.OPENAI_API_KEY), provider: USE_LOCAL_CODEX ? 'local-codex' : 'openai-api', rubricVersion: RUBRIC_VERSION, groundingVersion: GROUNDING_VERSION });
  });

  // Evidence understanding, deterministic scoring, and editing advice are separate stages.
  app.post('/api/evaluate-reel', async (req, res) => {
    try {
      if (USE_LOCAL_CODEX && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')) {
        res.status(403).json({ error: 'LOCAL_REVIEW_ONLY', message: 'Open this local Codex review on the computer running PreViral.' });
        return;
      }
      // Codex does not receive raw audio. Use the existing transcription endpoint only when a key is available.
      const dependencies = USE_LOCAL_CODEX ? {
        call: callCodexStructured,
        transcribe: async (_credential: string, wav: string) => process.env.OPENAI_API_KEY ? transcribe(process.env.OPENAI_API_KEY, wav) : '',
        explain: (...args: Parameters<typeof explain>) => explain(args[0], args[1], args[2], args[3], args[4], args[5], callCodexStructured),
      } : undefined;
      const result = await evaluate(req.body, USE_LOCAL_CODEX ? 'local-codex-session' : process.env.OPENAI_API_KEY, USE_LOCAL_CODEX ? CODEX_MODEL : OPENAI_MODEL, dependencies);
      res.json(result);
    } catch (error) {
      const status = error instanceof EvaluationError ? error.status : 502;
      const code = error instanceof EvaluationError ? error.code : 'AI_VIDEO_ANALYSIS_FAILED';
      console.warn('Video evaluation did not complete:', code);
      res.status(status).json({ error: code, message: error instanceof EvaluationError ? error.message : 'The video review did not finish. Please retry. No substitute rating was generated.', grounding: error instanceof EvaluationError ? error.grounding : undefined });
    }
  });

  // AI Hook & Caption Generator
  app.post('/api/generate-captions', async (req, res) => {
    try {
      const { topic, niche, tone, language = 'en' } = req.body;
      const openAIApiKey = getOpenAIApiKey();

      if (!openAIApiKey) {
        if (language === 'ko') {
          return res.json({
            hooks: [
              `스토리를 멈추고 싶다면 ${topic || '이 연출 노하우'}부터 시작해보세요! 🔥`,
              `아무도 말해주지 않는 ${topic || '콘텐츠 제작'} 0원 핵심 비결... 🤫`,
              `30일 동안 직접 테스트해본 결과, 이렇게 바뀌었습니다 👇`,
            ],
            valueCTA: `매일 업로드되는 ${niche || '크리에이티브'} 성장 꿀팁을 위해 팔로우하세요!`,
            cliffhangerCTA: `다음 릴스에서 세부 설정법을 100% 공개합니다 — 놓치지 않으려면 팔로우!`,
            commentBaitQuestion: `어떤 방법을 먼저 적용해보고 싶으신가요? 댓글로 의견을 나눠주세요!`,
            hashtags: ['#릴스성장', '#콘텐츠크리에이터', '#바이럴릴스', '#인스타그램팁', '#크리에이터노하우'],
          });
        }

        return res.json({
          hooks: [
            `Stop scrolling if you want to master ${topic || 'this technique'}! 🔥`,
            `The $0 secret to ${topic || 'better content'} nobody is telling you... 🤫`,
            `I tested this for 30 days so you don't have to 👇`,
          ],
          valueCTA: `Follow for daily ${niche || 'creative'} growth tips & tutorials!`,
          cliffhangerCTA: `Revealing the exact steps in my next Reel—hit follow so you don't miss it!`,
          commentBaitQuestion: `Which method would you try first? A or B? Comment below!`,
          hashtags: ['#reelsgrowth', '#contentcreator', '#viralreels', '#instagramtips', '#creatortips'],
        });
      }

      const prompt =
        language === 'ko'
          ? `Generate high-retention viral Instagram Reel hooks and caption packages for a video about "${topic || 'creative tutorial'}" in the "${niche || 'General'}" niche with a "${tone || 'energetic'}" tone. CRITICAL: Generate ALL text in fluent, natural human Korean (한국어).`
          : `Generate high-retention viral Instagram Reel hooks and caption packages for a video about "${topic || 'creative tutorial'}" in the "${niche || 'General'}" niche with a "${tone || 'energetic'}" tone. Follow 2026 Instagram growth principles.`;

      return res.json(await createOpenAIResponse(openAIApiKey, prompt));
    } catch (err) {
      console.error('Caption generator error:', err);
      return res.status(500).json({ error: 'Failed to generate captions' });
    }
  });

  // Serve Vite in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Reels Evaluation Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
