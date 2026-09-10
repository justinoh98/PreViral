import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EvaluationError } from './validation';

const execute = promisify(execFile);
const executable = () => process.env.PREVIRAL_CODEX_EXECUTABLE || 'codex';
export async function codexAvailable(): Promise<boolean> {
  try {
    const result = await execute(executable(), ['login', 'status'], { windowsHide: true, timeout: 10000, maxBuffer: 64_000 });
    return /logged in/i.test(result.stdout + result.stderr);
  } catch { return false; }
}
export function codexArguments(directory: string, model: string, images: string[]): string[] {
  return ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never',
    '--disable', 'shell_tool', '--disable', 'unified_exec', '--disable', 'apps', '--disable', 'plugins', '--disable', 'hooks', '--disable', 'multi_agent',
    '--disable', 'browser_use', '--disable', 'computer_use', '--disable', 'image_generation', '--disable', 'code_mode_host',
    '--disable', 'workspace_dependencies', '--disable', 'skill_search', '--disable', 'memories', '--disable', 'view_image', '--disable', 'goals',
    '-c', 'web_search="disabled"', '-c', 'project_doc_max_bytes=0', '-c', 'model_reasoning_effort="medium"',
    '-C', directory, '-m', model, '--output-schema', path.join(directory, 'schema.json'), '-o', path.join(directory, 'response.json'),
    ...images.flatMap(file => ['--image', file]), '-'];
}
export async function callCodexStructured(_credential: string, model: string, instructions: string, content: unknown[], schema: unknown, _name: string): Promise<unknown> {
  // Only the explicitly selected development provider calls the local signed-in CLI.
  // No auth files are read by PreViral and no account token is exposed to the browser.
  const directory = await mkdtemp(path.join(tmpdir(), 'previral-review-'));
  try {
    const images: string[] = [];
    const prompt: string[] = [instructions, 'Use only the supplied evidence. Do not use tools, inspect files, browse, or modify anything. Return the requested JSON only.'];
    for (const raw of content) {
      const part = raw as { type: string; text?: string; image_url?: string };
      if (part.type === 'input_text' && typeof part.text === 'string') prompt.push(part.text);
      else if (part.type === 'input_image' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(part.image_url || '')) {
        const file = path.join(directory, `image-${String(images.length + 1).padStart(3, '0')}.jpg`);
        await writeFile(file, Buffer.from(part.image_url!.split(',')[1], 'base64'));
        images.push(file);
        prompt.push(`The evidence immediately above refers to attached image ${images.length}. Images are attached in this same chronological order.`);
      } else throw new EvaluationError('INVALID_VIDEO', 'The local reviewer received unsupported evidence.');
    }
    await writeFile(path.join(directory, 'schema.json'), JSON.stringify(schema));
    const args = codexArguments(directory, model, images);
    // No shell is involved; image paths, model and prompt cannot become shell commands.
    await new Promise<void>((resolve, reject) => {
      const child = execFile(executable(), args, { windowsHide: true, timeout: 300000, maxBuffer: 8_000_000 }, error => error ? reject(error) : resolve());
      child.stdin?.on('error', () => {});
      child.stdin?.end(prompt.join('\n\n'));
    });
    return JSON.parse(await readFile(path.join(directory, 'response.json'), 'utf8'));
  } catch (error) {
    if (error instanceof EvaluationError) throw error;
    throw new EvaluationError('CODEX_ANALYSIS_UNAVAILABLE', 'The local Codex review did not finish. Check Codex sign-in, model access and usage limits, then retry. No substitute rating was generated.', 503);
  } finally {
    const resolved = path.resolve(directory);
    const parent = path.resolve(tmpdir());
    if (path.dirname(resolved) === parent && path.basename(resolved).startsWith('previral-review-')) await rm(resolved, { recursive: true, force: true });
  }
}
