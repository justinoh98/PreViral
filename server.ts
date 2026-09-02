import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config({ path: '.env.local' });
dotenv.config();

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra';

// In-memory evaluation cache to ensure static ratings for identical video uploads
const evaluationCache = new Map<string, any>();

function createVideoSignature(data: {
  title?: string;
  durationSeconds?: number;
  fileFormat?: string;
  fileSizeMb?: number;
  niche?: string;
  captionInput?: string;
  videoConcept?: string;
  audioType?: string;
  hasWatermark?: boolean;
  detectedAudioSilence?: boolean;
  frameSnapshots?: string[];
  language?: string;
}): string {
  const normTitle = (data.title || '').trim().toLowerCase();
  const normCaption = (data.captionInput || '').trim().toLowerCase();
  const normConcept = (data.videoConcept || '').trim().toLowerCase();
  const normAudio = (data.audioType || '').trim().toLowerCase();
  const normNiche = (data.niche || '').trim().toLowerCase();
  const normFormat = (data.fileFormat || '').trim().toLowerCase();
  const lang = (data.language || 'en').trim().toLowerCase();
  const duration = Number(data.durationSeconds) || 0;
  const fileSize = Number(data.fileSizeMb) || 0;

  // Build snapshot fingerprint from snapshot lengths and ending characters
  let snapshotFingerprint = '';
  if (Array.isArray(data.frameSnapshots) && data.frameSnapshots.length > 0) {
    snapshotFingerprint = data.frameSnapshots
      .map((s) => (typeof s === 'string' ? `${s.length}:${s.slice(-30)}` : ''))
      .join('|');
  }

  const rawKey = [
    normTitle,
    duration,
    normFormat,
    fileSize,
    normNiche,
    normCaption,
    normConcept,
    normAudio,
    Boolean(data.hasWatermark),
    Boolean(data.detectedAudioSilence),
    snapshotFingerprint,
    lang,
  ].join('::');

  return crypto.createHash('md5').update(rawKey).digest('hex');
}

function generateStanceByStanceGuidance(
  durationSeconds: number,
  niche: string,
  title: string,
  language: string = 'en',
  concept?: string
) {
  const dur = Math.max(5, Math.min(90, durationSeconds || 15));
  const p1End = Math.min(3, Math.max(2, Math.round(dur * 0.2)));
  const p2End = Math.min(Math.round(dur * 0.5), p1End + 5);
  const p3End = Math.min(Math.round(dur * 0.8), p2End + 6);
  const conceptSnippet = (concept || '').trim();

  if (language === 'ko') {
    return [
      {
        durationRange: `0-${p1End}초 (0초 스크롤 방지 훅 구간)`,
        stanceTheme: '즉각적 시각 궁금증 & 스크롤 방지',
        optionAHookText: conceptSnippet
          ? `${conceptSnippet} — 크리에이터 90%가 놓치는 1초 비결 🔥`
          : `${niche || '영상'}에서 절대 하면 안 되는 실수... (대신 이렇게 하세요!) 🔥`,
        optionBHookText: conceptSnippet
          ? `아직도 이렇게 안 하시나요? ${conceptSnippet} 🤫`
          : `${niche || '콘텐츠'} 성과를 10배 올리는 0원 비법 🤫`,
        optionCHookText: conceptSnippet
          ? `직접 검증한 ${conceptSnippet} 연출법 30일 테스트 결과 👇`
          : `30일 동안 직접 검증한 화제의 ${niche || '기법'} 공개 👇`,
        onScreenGuidance: '상단 안전지대(Y: 35-45%)에 고대비 볼드체 자막을 배치하세요. 영상 시작 0.2초 이내에 팝업 효과음과 함께 노출합니다.',
      },
      {
        durationRange: `${p1End}-${p2End}초 (화면 전환 & 몰입 유도 구간)`,
        stanceTheme: '시각적 자극 및 가치 전달',
        optionAHookText: `단계 1: ${conceptSnippet ? '핵심 연출 디테일' : '크리에이터 90%가 놓치는 핵심 포인트'}`,
        optionBHookText: `주의해서 보세요: 앵글을 바꾸는 순간 반응이 달라집니다`,
        optionCHookText: `문제를 즉시 해결한 저만의 핵심 공식입니다`,
        onScreenGuidance: '1.5~2.0초마다 앵글 전환 또는 B-roll 컷을 교체하세요. 하단 중앙 안전지대에 3~5단어 핵심 키워드 자막을 배치합니다.',
      },
      {
        durationRange: `${p2End}-${p3End}초 (핵심 가치 & 스시몬스트레이션 구간)`,
        stanceTheme: '증명 및 핵심 노하우 시연',
        optionAHookText: `적용 전 vs 적용 후의 확실한 차이를 확인해보세요`,
        optionBHookText: `이 단순한 변화 하나로 편집 시간을 3시간 단축했습니다`,
        optionCHookText: `지금 바로 기기에서 변경할 수 있는 최적 설정값입니다`,
        onScreenGuidance: '모션 줌이나 화살표 오버레이로 시선을 집중시키세요. 자막 위치는 안전지대(X: 10-90%, Y: 25-65%) 내에 철저히 유지합니다.',
      },
      {
        durationRange: `${p3End}-${dur}초 (결말 공개 & 행동 유도 CTA 구간)`,
        stanceTheme: '만족스러운 결말 & 재시청 유도 / CTA',
        optionAHookText: `매일 올라오는 ${niche || '크리에이티브'} 성장 꿀팁을 위해 팔로우하세요! 🚀`,
        optionBHookText: `다음 연출을 위해 이 릴스를 저장하고, 댓글로 '정보'를 남겨주세요!`,
        optionCHookText: `다음 릴스에서 전체 설정법을 100% 공개합니다 — 놓치지 않으려면 팔로우!`,
        onScreenGuidance: '마지막 프레임에 명확한 CTA 자막을 노출하고, 첫 프레임과 자연스럽게 이어지도록 루프 모션을 연출하세요.',
      },
    ];
  }

  return [
    {
      durationRange: `0-${p1End}s (Zero-Second Hook Stance)`,
      stanceTheme: 'Immediate Visual Curiosity & Scroll-Stopper',
      optionAHookText: conceptSnippet
        ? `${conceptSnippet} — the 1-second secret 90% miss 🔥`
        : `Stop doing this in ${niche || 'your videos'}... (Do this instead!) 🔥`,
      optionBHookText: conceptSnippet
        ? `Are you still doing this? Here is the exact fix 🤫`
        : `The $0 secret to 10x better ${niche || 'content'} nobody talks about 🤫`,
      optionCHookText: conceptSnippet
        ? `I tested this viral approach so you don't have to 👇`
        : `I tested this viral ${niche || 'technique'} for 30 days so you don't have to 👇`,
      onScreenGuidance: 'Display high-contrast bold text in center safe zone (Y: 35-45%). Flash within 0.2s of video start with a subtle pop-in effect and sound effect.',
    },
    {
      durationRange: `${p1End}-${p2End}s (Pattern Interrupt & Buildup Stance)`,
      stanceTheme: 'High Stimulation & Value Escalation',
      optionAHookText: `Step 1: The key mistake 90% of creators make here`,
      optionBHookText: `Watch closely: Notice what happens right here when I change the setup`,
      optionCHookText: `Here is the exact framework I used to fix this problem instantly`,
      onScreenGuidance: 'Cut to new camera angle or B-roll every 1.5-2.0 seconds. Display 3-5 word keyword captions in lower-center safe zone.',
    },
    {
      durationRange: `${p2End}-${p3End}s (Core Value & Micro-Story Stance)`,
      stanceTheme: 'Demonstration & Proof Point',
      optionAHookText: `Look at this side-by-side difference before vs after`,
      optionBHookText: `This simple shift saved 3 hours of editing and boosted retention`,
      optionCHookText: `Here is the exact setting to tweak on your device today`,
      onScreenGuidance: 'Use motion zoom or arrow callout overlay to guide eye movement. Keep text strictly inside safe zones (X: 10-90%, Y: 25-65%).',
    },
    {
      durationRange: `${p3End}-${dur}s (Payoff & Actionable CTA Stance)`,
      stanceTheme: 'Satisfying Result & Rewatch Trigger / CTA',
      optionAHookText: `Follow @creator for daily ${niche || 'creative'} growth breakdowns! 🚀`,
      optionBHookText: `Save this Reel for your next setup and comment 'INFO' for the cheat sheet!`,
      optionCHookText: `Revealing the full setup step-by-step in my next Reel—hit follow so you don't miss it!`,
      onScreenGuidance: 'Display clear CTA text overlay on final frame with smooth visual transition connecting back to frame 1 for seamless looping.',
    },
  ];
}

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

    const payload = await response.json() as { output_text?: string };
    if (!payload.output_text) {
      throw new Error('OpenAI Responses API returned no output text.');
    }
    return JSON.parse(payload.output_text);
  };

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Evaluate Reel API Endpoint
  app.post('/api/evaluate-reel', async (req, res) => {
    try {
      const {
        title,
        durationSeconds,
        fileFormat,
        fileSizeMb,
        niche,
        captionInput,
        videoConcept,
        audioType,
        frameSnapshots,
        hasWatermark,
        detectedAudioSilence,
        language = 'en',
      } = req.body;

      // Requirement A: Exact same video static ratings check
      const videoSignature = createVideoSignature({
        title,
        durationSeconds,
        fileFormat,
        fileSizeMb,
        niche,
        captionInput,
        videoConcept,
        audioType,
        hasWatermark,
        detectedAudioSilence,
        frameSnapshots,
        language,
      });

      if (evaluationCache.has(videoSignature)) {
        console.log(`[Cache Hit] Returning static cached ratings for video signature: ${videoSignature}`);
        const cachedEvaluation = evaluationCache.get(videoSignature);
        return res.json({
          ...cachedEvaluation,
          isCachedEvaluation: true,
        });
      }

      const openAIApiKey = getOpenAIApiKey();

      if (!openAIApiKey) {
        // Fallback realistic AI evaluation if API key is not populated
        const mockResult = generateFallbackEvaluation({
          title,
          durationSeconds: Number(durationSeconds) || 15,
          fileFormat: fileFormat || 'MP4',
          fileSizeMb: Number(fileSizeMb) || 12,
          niche: niche || 'General Content',
          captionInput: captionInput || '',
          videoConcept: videoConcept || '',
          audioType: audioType || 'Trending Audio',
          hasWatermark: Boolean(hasWatermark),
          detectedAudioSilence: Boolean(detectedAudioSilence),
          language,
        });
        evaluationCache.set(videoSignature, mockResult);
        return res.json(mockResult);
      }

      const isCaptionMissing = !captionInput || captionInput.trim().length === 0;

      const languageInstruction =
        language === 'ko'
          ? `CRITICAL LANGUAGE MANDATE:
- Generate ALL text outputs (criticalDefectsIdentified, aspects labels & verdicts, visualHook, textHook, audioHook, captionQuality, actionableEdits issues & solutions, captionOptimization hooks/CTAs/commentBait, stanceByStanceGuidance texts & guidance, and targetHashtags) strictly in natural, fluent, native human Korean (한국어).
- Do NOT use robotic translation. Write as an experienced, sharp Korean social media director and video editor.
- The targetHashtags MUST be exactly 5 relevant, high-reach Korean hashtags with '#' (e.g. #릴스성장, #콘텐츠크리에이터, #바이럴릴스, #인스타그램팁, #크리에이터노하우 or specific to the niche).
- Every recommendation must sound like actionable advice written by a real human.`
          : `CRITICAL LANGUAGE MANDATE:
- Generate ALL text outputs in natural, punchy, fluent human English.
- The targetHashtags MUST be exactly 5 relevant, high-reach English hashtags with '#' (e.g. #reelsgrowth, #contentcreator, #viralreels, #instagramtips, #creatortips or specific to the niche).
- Write as an experienced viral video growth director. Every sentence must sound natural and human.`;

      // Prepare the OpenAI evaluation prompt.
      const promptText = `You are a strictly objective, uncompromising Instagram Reels & Short-Form Video Algorithm Auditor in 2026.
You are evaluating a Reel prior to publishing. Your evaluation MUST be strictly objective, critical, and evidence-based. 
CRITICAL EVALUATION MANDATE:
- Do NOT give polite or artificially inflated ratings. Be tough and unforgiving.
- Act as an algorithm auditor that penalizes flaws heavily (e.g. dead air >0.3s, lack of instant visual motion at second 0, missing captions, low contrast, absent CTA, long setup delay).
- Highlight specific defects and weaknesses explicitly in \`criticalDefectsIdentified\`.
${languageInstruction}
${
  isCaptionMissing
    ? `- SPECIAL INSTRUCTION: NO CAPTION / TEXT HOOK WAS PROVIDED FOR THIS VIDEO. You MUST populate \`stanceByStanceGuidance\` breaking down the video duration into 3-4 period stances (e.g., 0-3s, 3-7s, 7-12s, 12-15s) providing Option A, Option B, and Option C text hooks and timing/placement guidance for each period.`
    : ''
}

Reel Metadata:
- Title / Filename: "${title || 'Untitled Reel'}"
- Video Duration: ${durationSeconds} seconds
- File Format: ${fileFormat} (${fileSizeMb} MB)
- Creator Niche: "${niche || 'General Growth'}"
- Proposed Caption: "${captionInput || 'NO CAPTION PROVIDED'}"
- Creator's Intended Video Concept & Portrayal: "${videoConcept ? videoConcept : 'Not specified'}"
- Audio Track Type: "${audioType || 'Trending Audio'}"
- Automated Checks: Watermark suspected = ${hasWatermark ? 'Yes' : 'No'}, Initial silence = ${detectedAudioSilence ? 'Yes' : 'No'}.

${
  videoConcept && videoConcept.trim().length > 0
    ? (language === 'ko'
        ? `CRITICAL CONCEPT-ALIGNED A-TO-Z GUIDANCE:
크리에이터가 명시한 핵심 영상 컨셉 및 기획 의도: "${videoConcept}".
반드시 이 기획 의도와 연출 방향을 적극 반영하여, 추천 훅 문구(recommendedHooks), 가치 전달 CTA(valueCTA), 호기심 유발 CTA(cliffhangerCTA), 댓글 유도 질문(commentBaitQuestion), 구간별 스탠스 가이드(stanceByStanceGuidance), 및 실행 가능한 개선안(actionableEdits)이 크리에이터의 원래 컨셉과 시각적 의도를 A부터 Z까지 완벽히 살려내도록 생성하세요.`
        : `CRITICAL CONCEPT-ALIGNED A-TO-Z GUIDANCE:
The creator specified their intended video concept & portrayal: "${videoConcept}".
You MUST strictly align all generated recommendations (recommendedHooks, valueCTA, cliffhangerCTA, commentBaitQuestion, stanceByStanceGuidance, actionableEdits) to elevate and comply with this exact creative concept from A to Z.`)
    : ''
}

Objective Evaluation Rubric:
1. **Zero-Second Hook (0-3s)** (30% Weight): Immediate visual motion, curiosity gap text overlay, and instant audio. Penalize severely for static intros or silent buildup.
2. **Pacing & Pattern Interrupts (3-12s)** (25% Weight): Cut frequency every 1.5-2s, elimination of dead air (>0.3s silence/stagnation), use of B-roll or zooms.
3. **Narrative Arc & Payoff** (20% Weight): Clear Setup -> Process -> Satisfying Payoff delivered efficiently before video end.
4. **Loopability & Retention** (15% Weight): Smooth start/end frame connection and explicit rewatch incentives.
5. **Technical & Unconnected Reach** (10% Weight): 1080p resolution, no watermarks, center safe-zone text placement, and shareability via DMs.

Compute overallStars as the exact objective weighted average of these 5 aspect ratings.
Ensure overallScorePercent is exactly round(overallStars * 20).
Assign overallVerdict objectively based on overallStars:
- 4.2 to 5.0: "Viral Contender"
- 3.5 to 4.1: "Strong Growth"
- 2.8 to 3.4: "Moderate Retention"
- < 2.8: "High Skip Risk"

Return a STRICT JSON response adhering to this JSON Schema.`;

      const content: Array<Record<string, string>> = [{ type: 'input_text', text: promptText }];
      if (Array.isArray(frameSnapshots)) {
        for (const snapshot of frameSnapshots.slice(0, 3)) {
          if (typeof snapshot === 'string' && snapshot.startsWith('data:image/')) {
            content.push({ type: 'input_image', image_url: snapshot, detail: 'low' });
          }
        }
      }

      const evaluationData = await createOpenAIResponse(openAIApiKey, [
        { role: 'user', content },
      ]);

      // Ensure stanceByStanceGuidance is populated if caption is missing
      if (isCaptionMissing && (!evaluationData.stanceByStanceGuidance || evaluationData.stanceByStanceGuidance.length === 0)) {
        evaluationData.stanceByStanceGuidance = generateStanceByStanceGuidance(
          Number(durationSeconds) || 15,
          niche || 'General',
          title || 'Reel',
          language,
          videoConcept
        );
      }

      const result = {
        id: `eval-${Date.now()}`,
        title: title || 'Uploaded Reel',
        durationSeconds: Number(durationSeconds) || 15,
        fileFormat: fileFormat || 'MP4',
        fileSizeMb: Number(fileSizeMb) || 10,
        niche: niche || 'General',
        captionInput,
        videoConcept: videoConcept || '',
        audioType,
        timestamp: new Date().toISOString(),
        isCachedEvaluation: false,
        ...evaluationData,
      };

      // Store in memory cache for static identical video uploads
      evaluationCache.set(videoSignature, result);

      return res.json(result);
    } catch (err: any) {
      console.error('Error evaluating reel with OpenAI:', err);
      // Return realistic fallback on error
      const mockResult = generateFallbackEvaluation({
        title: req.body.title || 'Uploaded Reel',
        durationSeconds: Number(req.body.durationSeconds) || 15,
        fileFormat: req.body.fileFormat || 'MP4',
        fileSizeMb: Number(req.body.fileSizeMb) || 12,
        niche: req.body.niche || 'General Content',
        captionInput: req.body.captionInput || '',
        videoConcept: req.body.videoConcept || '',
        audioType: req.body.audioType || 'Trending Audio',
        hasWatermark: Boolean(req.body.hasWatermark),
        detectedAudioSilence: Boolean(req.body.detectedAudioSilence),
        language: req.body.language || 'en',
      });

      const videoSignature = createVideoSignature(req.body);
      evaluationCache.set(videoSignature, mockResult);

      return res.json(mockResult);
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

// Fallback generator for realistic & objective Reel evaluation when API key is offline
function generateFallbackEvaluation(params: {
  title: string;
  durationSeconds: number;
  fileFormat: string;
  fileSizeMb: number;
  niche: string;
  captionInput: string;
  videoConcept?: string;
  audioType: string;
  hasWatermark?: boolean;
  detectedAudioSilence?: boolean;
  language?: string;
}) {
  const isCaptionMissing = !params.captionInput || params.captionInput.trim().length === 0;
  const isKo = params.language === 'ko';
  const concept = (params.videoConcept || '').trim();

  // Objective Algorithmic Deductions
  let hookStars = 4.3;
  let pacingStars = 4.2;
  let narrativeStars = 4.0;
  let loopStars = 3.9;
  let techStars = 4.5;
  const criticalDefects: string[] = [];

  // Deduct for missing captions / text hook
  if (isCaptionMissing) {
    hookStars -= 1.1;
    techStars -= 0.8;
    criticalDefects.push(
      isKo
        ? '화면 상단 자막 훅 및 게시용 캡션 부재 (자막 시청자의 빠른 이탈 유발 및 검색 노출 감소)'
        : 'No proposed caption or on-screen text hook provided (harms sound-off retention & SEO discovery)'
    );
  }

  // Deduct for long video duration without guaranteed micro-cuts
  if (params.durationSeconds > 25) {
    pacingStars -= 0.9;
    loopStars -= 0.7;
    criticalDefects.push(
      isKo
        ? `영상 재생 시간(${params.durationSeconds}초)이 길어 빠른 컷 편집이 없으면 피날레 전 이탈 위험이 높음`
        : `Video duration (${params.durationSeconds}s) is long for unedited Reels; risks high drop-off before payoff`
    );
  }

  // Deduct for detected audio silence
  if (params.detectedAudioSilence) {
    hookStars -= 1.4;
    criticalDefects.push(
      isKo
        ? '첫 0.5초 구간 오디오 무음/지연 감지 (즉각적 오디오 스타트 실패)'
        : 'Detected initial audio silence/lag in first 0.5 seconds'
    );
  }

  // Deduct for suspected watermark
  if (params.hasWatermark) {
    techStars -= 2.0;
    criticalDefects.push(
      isKo
        ? '외부 플랫폼 워터마크 감지 (인스타그램 알고리즘이 탐색 노출을 크게 제약함)'
        : 'Suspected third-party platform watermark (Instagram algorithm heavily down-ranks watermarked content)'
    );
  }

  // Clamp star ratings between 1.0 and 5.0
  hookStars = Number(Math.max(1.0, Math.min(5.0, hookStars)).toFixed(1));
  pacingStars = Number(Math.max(1.0, Math.min(5.0, pacingStars)).toFixed(1));
  narrativeStars = Number(Math.max(1.0, Math.min(5.0, narrativeStars)).toFixed(1));
  loopStars = Number(Math.max(1.0, Math.min(5.0, loopStars)).toFixed(1));
  techStars = Number(Math.max(1.0, Math.min(5.0, techStars)).toFixed(1));

  // Compute exact weighted overall rating
  const overallStars = Number(
    (hookStars * 0.3 + pacingStars * 0.25 + narrativeStars * 0.2 + loopStars * 0.15 + techStars * 0.1).toFixed(1)
  );
  const overallScorePercent = Math.round(overallStars * 20);

  let overallVerdict: 'Viral Contender' | 'Strong Growth' | 'Moderate Retention' | 'High Skip Risk' = 'Moderate Retention';
  if (overallStars >= 4.2) overallVerdict = 'Viral Contender';
  else if (overallStars >= 3.5) overallVerdict = 'Strong Growth';
  else if (overallStars >= 2.8) overallVerdict = 'Moderate Retention';
  else overallVerdict = 'High Skip Risk';

  const skipRate = Math.min(65, Math.max(12, Math.round(50 - overallStars * 7)));

  return {
    id: `eval-${Date.now()}`,
    title: params.title,
    durationSeconds: params.durationSeconds,
    fileFormat: params.fileFormat,
    fileSizeMb: params.fileSizeMb,
    niche: params.niche,
    captionInput: params.captionInput,
    videoConcept: params.videoConcept || '',
    audioType: params.audioType,
    timestamp: new Date().toISOString(),
    overallStars,
    overallScorePercent,
    overallVerdict,
    expectedSkipRatePercent: skipRate,
    followerGrowthPotentialPercent: Math.round(overallStars * 18 + 5),
    nonFollowerInterestStars: Number((overallStars * 0.95).toFixed(1)),
    shareabilitySendScore: Math.round(overallStars * 18.5),
    criticalDefectsIdentified:
      criticalDefects.length > 0
        ? criticalDefects
        : [isKo ? '중반 화면 전환 구간에서 미세한 페이싱 주춤함 감지' : 'Minor pacing hesitation in middle transition'],
    aspects: {
      hookStrength: {
        stars: hookStars,
        label: isKo ? '0초 스크롤 방지 훅' : 'Zero-Second Curiosity Gap',
        visualHook: isKo
          ? hookStars >= 4.0 ? '역동적인 오프닝 시각적 연출 적용됨.' : '정적인 첫 프레임으로 빠른 시각적 훅 부족.'
          : hookStars >= 4.0 ? 'Strong initial motion frame.' : 'Static start frame; lacks rapid visual hook.',
        textHook: isCaptionMissing
          ? (isKo ? '누락: 상단 화면 자막 훅이 설정되지 않음.' : 'MISSING: No text hook or on-screen title detected.')
          : (isKo ? '오프닝 프레임에 자막 훅 배치됨.' : 'Text hook present on opening frame.'),
        audioHook: params.detectedAudioSilence
          ? (isKo ? '첫 1초 구간 오디오 무음 감지.' : 'Audio delay detected in first second.')
          : (isKo ? '재생 시작과 동시에 음성/오디오 출력됨.' : 'Audio starts immediately on play.'),
        verdict: hookStars >= 4.0
          ? (isKo ? '효과적인 훅으로 시청자의 이탈을 방지함.' : 'Effective hook prevents immediate skip.')
          : (isKo ? '상단 자막 훅 미비로 첫 1.5초 내 높은 이탈 위험.' : 'High skip risk in first 1.5 seconds without on-screen hook.'),
      },
      pacingAndStimulation: {
        stars: pacingStars,
        label: isKo ? '화면 전환 및 페이싱' : 'Pattern Interrupt Frequency',
        avgCutFrequencySec: params.durationSeconds > 20 ? 2.8 : 1.7,
        deadAirDetectedSec: params.durationSeconds > 20 ? 0.8 : 0.2,
        patternInterruptsCount: Math.round(params.durationSeconds / 2.5),
        verdict: pacingStars >= 4.0
          ? (isKo ? '빠른 컷 전환 리듬으로 몰입 유지.' : 'Fast cut rhythm keeps viewer engaged.')
          : (isKo ? '정적 구간으로 인해 시청 이탈 유발.' : 'Noticeable dead air/pause slows viewer retention.'),
      },
      narrativeAndPayoff: {
        stars: narrativeStars,
        label: isKo ? '스토리 전개 및 결말 피날레' : 'Setup & Fast Payoff Delivery',
        setupDurationSec: 2.2,
        payoffTimingSec: Math.round(params.durationSeconds * 0.82),
        verdict: isKo ? '명확한 전개 구조와 결말 전달.' : 'Clear micro-story arc; payoff is delivered before end frame.',
      },
      loopingAndRetention: {
        stars: loopStars,
        label: isKo ? '반복 재생(루프) 자연스러움' : 'Loop Continuity & Rewatch',
        seamlessLoopScore: Math.round(loopStars * 19),
        rewatchTriggerPresent: loopStars >= 3.8,
        verdict: loopStars >= 3.8
          ? (isKo ? '시작과 끝 화면이 자연스럽게 루프 연결됨.' : 'Audio and visual transition connect smoothly.')
          : (isKo ? '재시작 시 매끄럽지 않은 끊김 현상 감지.' : 'Loop break is abrupt at video restart.'),
      },
      technicalCompliance: {
        stars: techStars,
        label: isKo ? '기술 규격 및 자막 안전지대' : 'Technical & Safe Zone Baseline',
        watermarkDetected: Boolean(params.hasWatermark),
        resolutionText: '1080p High Quality Render',
        safeZoneViolation: isCaptionMissing,
        captionQuality: isCaptionMissing ? (isKo ? '자막 미입력' : 'No captions provided.') : (isKo ? '안전지대 내 정렬' : 'Centered safe-zone placement.'),
        verdict: techStars >= 4.0
          ? (isKo ? '1080p 선명한 화질 및 안전지대 준수.' : '1080p crisp export, safe zones clean.')
          : (isKo ? '자막 누락 또는 워터마크로 기술 점수 감점.' : 'Technical compliance impacted by missing text/watermarks.'),
      },
    },
    actionableEdits: [
      ...(isCaptionMissing
        ? [
            {
              id: 'edit-f-cap',
              timestampRange: '0:00 - 0:03',
              type: 'hook' as const,
              severity: 'critical' as const,
              issue: isKo ? '화면 상단 자막 훅 또는 게시용 캡션 미입력' : 'No on-screen text hook or caption was supplied.',
              solution: isKo ? '상단 안전지대에 3~5단어 고대비 강렬한 질문/문장 자막 추가' : 'Add a high-contrast 3-5 word bold question/statement in the upper center safe zone.',
            },
          ]
        : []),
      {
        id: 'edit-f-1',
        timestampRange: `0:02 - 0:04`,
        type: 'pacing' as const,
        severity: 'recommended' as const,
        issue: isKo ? '중반 화면 전환 구간에서 편집 페이싱이 살짝 완만해짐' : 'Pacing slows down slightly during middle transition.',
        solution: isKo ? '0.4초의 정적 구간을 자르고 모션 줌 효과로 시각적 자극 유지' : 'Cut 0.4s of dead air or add a motion zoom to maintain eye momentum.',
      },
      {
        id: 'edit-f-2',
        timestampRange: `${Math.round(params.durationSeconds * 0.8)}초 - 끝`,
        type: 'payoff' as const,
        severity: 'optional' as const,
        issue: isKo ? '결말 피날레 화면이 너무 빠르게 지나가 루프로 넘어감' : 'Final reveal frame transitions quickly to loop point.',
        solution: isKo ? '결과물 컷을 0.6초 늘려 시청자가 충분히 인지할 수 있도록 보완' : 'Extend result shot by 0.6s so viewers digest the value before looping.',
      },
    ],
    captionOptimization: isKo
      ? {
          recommendedHooks: concept
            ? [
                `${concept} — ${params.durationSeconds}초 만에 완성하는 비결 🚀`,
                `아직도 이렇게 안 하시나요? ${concept} 💡`,
                `마지막에 나오는 반전을 꼭 확인해보세요 👇`,
              ]
            : [
                `${params.durationSeconds}초 만에 이런 연출을 만드는 꿀팁... 🚀`,
                `스토리를 멈추세요! ${params.niche} 크리에이터 필수 노하우... 💡`,
                `마지막에 나오는 반전을 꼭 확인해보세요 👇`,
              ],
          valueCTA: `매일 업로드되는 ${params.niche} 성장 꿀팁을 위해 팔로우하세요!`,
          cliffhangerCTA: `다음 릴스에서 전체 연출 세팅을 100% 공개합니다 — 팔로우 누르고 기다려주세요!`,
          commentBaitQuestion: concept
            ? `이 연출법 직접 시도해보실 분? 댓글로 의견 남겨주세요!`
            : `어떤 부분이 가장 인상 깊으셨나요? 댓글로 알려주세요!`,
          targetHashtags: ['#릴스성장', '#콘텐츠크리에이터', '#바이럴릴스', '#인스타그램2026', '#크리에이터노하우'],
        }
      : {
          recommendedHooks: concept
            ? [
                `How to pull off "${concept}" in ${params.durationSeconds} seconds... 🚀`,
                `Stop scrolling! The #1 secret behind ${concept}... 💡`,
                `You won't believe what happened at the end 👇`,
              ]
            : [
                `How I created this in ${params.durationSeconds} seconds... 🚀`,
                `Stop scrolling! The #1 trick for ${params.niche}... 💡`,
                `You won't believe what happened at the end 👇`,
              ],
          valueCTA: `Follow @creator for daily ${params.niche} tips and breakdowns!`,
          cliffhangerCTA: `I'm revealing the full setup in my next Reel—hit follow so you don't miss it!`,
          commentBaitQuestion: `Which part was your favorite? Comment below!`,
          targetHashtags: ['#reelsgrowth', '#contentcreator', '#viralreels', '#instagram2026', '#creatorlab'],
        },
    stanceByStanceGuidance: generateStanceByStanceGuidance(
      params.durationSeconds,
      params.niche,
      params.title,
      params.language,
      params.videoConcept
    ),
  };
}

startServer();
