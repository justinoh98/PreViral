import { EvaluationError } from './validation';

export function responseText(payload: any): string {
  if (payload?.status === 'incomplete' || payload?.error) throw new EvaluationError('AI_INCOMPLETE', 'The video review did not finish. Please retry.', 502);
  const parts: string[] = [];
  for (const item of payload?.output ?? []) {
    if (item.type !== 'message') continue;
    for (const content of item.content ?? []) {
      if (content.type === 'refusal') throw new EvaluationError('AI_UNAVAILABLE', 'This video could not be reviewed.', 422);
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  if (!parts.length) throw new EvaluationError('AI_INCOMPLETE', 'No video observations were returned. Please retry.', 502);
  return parts.join('');
}

export async function callStructured(apiKey: string, model: string, instructions: string, content: unknown[], schema: unknown, name: string): Promise<unknown> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(150_000),
    body: JSON.stringify({ model, store: false, instructions, input: [{ role: 'user', content }], reasoning: { effort: 'medium' }, max_output_tokens: 14000, text: { format: { type: 'json_schema', name, strict: true, schema } } }),
  });
  if (!response.ok) throw new EvaluationError('AI_UNAVAILABLE', `The video review service is unavailable (${response.status}). No substitute rating was generated.`, 502);
  try { return JSON.parse(responseText(await response.json())); }
  catch (error) { if (error instanceof EvaluationError) throw error; throw new EvaluationError('INVALID_ANALYSIS', 'The review was not returned in a usable format. Please retry.', 502); }
}

export async function transcribe(apiKey: string, wav: string): Promise<string> {
  const data = Buffer.from(wav.split(',')[1], 'base64');
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') throw new EvaluationError('INVALID_AUDIO', 'Invalid audio export.');
  const form = new FormData();
  form.append('model', 'gpt-4o-mini-transcribe');
  form.append('response_format', 'json');
  form.append('file', new Blob([new Uint8Array(data)], { type: 'audio/wav' }), 'reel.wav');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new EvaluationError('AUDIO_UNAVAILABLE', 'The spoken content could not be transcribed.', 502);
  const result = await response.json();
  if (typeof result.text !== 'string' || result.text.length > 30000) throw new EvaluationError('AUDIO_UNAVAILABLE', 'The transcript was incomplete.', 502);
  return result.text;
}
