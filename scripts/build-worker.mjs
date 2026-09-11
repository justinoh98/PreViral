import { build } from 'esbuild';
import { mkdir, cp, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
const files = {};
async function collect(dir) { for (const name of await readdir(dir, { withFileTypes: true })) { const full = path.join(dir, name.name); if (name.isDirectory()) await collect(full); else { const rel = '/' + path.relative('dist', full).replaceAll('\\', '/'); const ext = path.extname(name.name); files[rel] = { body: await readFile(full, 'utf8'), type: mime[ext] || 'text/plain; charset=utf-8' }; } } }
await collect('dist');
await writeFile('worker/assets.ts', `export const ASSETS = ${JSON.stringify(files)} as Record<string,{body:string,type:string}>;\n`);
await mkdir('dist/server', { recursive: true });
await build({ entryPoints: ['worker/index.ts'], outfile: 'dist/server/index.js', bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', sourcemap: false, conditions: ['worker', 'browser'] });
await mkdir('dist/.openai', { recursive: true });
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');
