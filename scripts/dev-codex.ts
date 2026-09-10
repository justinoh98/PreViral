import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

process.env.PREVIRAL_PROVIDER = 'codex';
if (!process.env.PREVIRAL_CODEX_EXECUTABLE && process.platform === 'win32' && process.env.LOCALAPPDATA) {
  const root = path.join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
  try {
    const installed = await Promise.all((await readdir(root)).map(async version => {
      const file = path.join(root, version, 'codex.exe');
      try { return { file, modified: (await stat(file)).mtimeMs }; } catch { return null; }
    }));
    const latest = installed.filter((item): item is { file: string; modified: number } => item !== null).sort((a, b) => b.modified - a.modified)[0];
    if (latest) process.env.PREVIRAL_CODEX_EXECUTABLE = latest.file;
  } catch { /* A normal PATH installation remains supported. */ }
}
await import('../server');
