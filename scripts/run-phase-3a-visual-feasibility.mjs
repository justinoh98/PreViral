import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const provider = process.argv.find(value => value.startsWith('--provider='))?.split('=')[1] ?? 'webgpu';
const dtype = process.argv.find(value => value.startsWith('--dtype='))?.split('=')[1] ?? 'q4f16';
const runTimeoutMs = Number(process.argv.find(value => value.startsWith('--timeout-ms='))?.split('=')[1] ?? 300_000);
const outputPath = process.argv.find(value => value.startsWith('--output='))?.slice('--output='.length) ?? `/tmp/previral-phase-3a-${provider}-${dtype}.json`;
if (!['webgpu', 'wasm'].includes(provider)) throw new Error('Provider must be webgpu or wasm.');
if (!['q4f16', 'q4'].includes(dtype)) throw new Error('Dtype must be q4f16 or q4.');
if (!Number.isFinite(runTimeoutMs) || runTimeoutMs < 1_000) throw new Error('Timeout must be at least 1000ms.');

const readChildren = async pid => {
  try {
    const value = await fs.readFile(`/proc/${pid}/task/${pid}/children`, 'utf8');
    return value.trim() ? value.trim().split(/\s+/).map(Number) : [];
  } catch { return []; }
};

const processTree = async rootPid => {
  const seen = new Set(); const pending = [rootPid];
  while (pending.length) {
    const pid = pending.pop();
    if (!pid || seen.has(pid)) continue;
    seen.add(pid); pending.push(...await readChildren(pid));
  }
  return [...seen];
};

const residentBytes = async rootPid => {
  let total = 0;
  for (const pid of await processTree(rootPid)) {
    try {
      const status = await fs.readFile(`/proc/${pid}/status`, 'utf8');
      const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
      if (match) total += Number(match[1]) * 1024;
    } catch {}
  }
  return total;
};

const vite = await createServer({
  root: process.cwd(),
  logLevel: 'error',
  server: {
    host: '127.0.0.1', port: 0,
    headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' },
  },
});
await vite.listen();
const address = vite.httpServer.address();
if (!address || typeof address === 'string') throw new Error('Vite did not expose a TCP port.');

const browserArgs = provider === 'webgpu'
  ? ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--disable-vulkan-surface']
  : [];
const browserServer = await chromium.launchServer({ headless: true, channel: 'chromium', args: browserArgs });
const browser = await chromium.connect(browserServer.wsEndpoint());
const context = await browser.newContext();
const page = await context.newPage();
const progress = [];
await page.exposeFunction('reportPhase3aProgress', detail => { progress.push({ at: Date.now(), detail }); });
await page.goto(`http://127.0.0.1:${address.port}/tools/phase-3a/`, { waitUntil: 'networkidle' });
await page.evaluate(() => window.addEventListener('phase3a-progress', event => {
  void window.reportPhase3aProgress((event).detail);
}));

const webgpu = await page.evaluate(async () => {
  if (!navigator.gpu) return { exposed: false, adapter: false, device: false, initializationMs: null };
  const start = performance.now();
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { exposed: true, adapter: false, device: false, initializationMs: performance.now() - start };
  try {
    const device = await adapter.requestDevice();
    const result = {
      exposed: true, adapter: true, device: true, initializationMs: performance.now() - start,
      features: [...adapter.features],
      limits: { maxBufferSize: adapter.limits.maxBufferSize, maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize },
    };
    device.destroy();
    return result;
  } catch (error) {
    return { exposed: true, adapter: true, device: false, initializationMs: performance.now() - start, error: String(error) };
  }
});

const rootPid = browserServer.process().pid;
const baselineRssBytes = await residentBytes(rootPid);
let peakRssBytes = baselineRssBytes;
const sampler = setInterval(() => { void residentBytes(rootPid).then(value => { peakRssBytes = Math.max(peakRssBytes, value); }); }, 100);
const startedAt = performance.now();
let run = null; let runError = null; let timedOut = false;
try {
  const running = page.evaluate(({ provider, dtype }) => window.phase3a.start(provider, dtype), { provider, dtype });
  let timeout;
  const bounded = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      reject(new Error(`Phase 3.3A run exceeded ${runTimeoutMs}ms.`));
      void page.evaluate(() => window.phase3a.cancel()).catch(() => {});
    }, runTimeoutMs);
  });
  try { run = await Promise.race([running, bounded]); }
  finally { clearTimeout(timeout); void running.catch(() => {}); }
} catch (error) {
  runError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
const wallMs = performance.now() - startedAt;

let cancellation;
try {
  cancellation = await page.evaluate(async ({ provider, dtype }) => {
    const pending = window.phase3a.start(provider, dtype).then(() => ({ settled: 'completed' }), error => ({ settled: 'rejected', name: error?.name, message: error?.message }));
    await new Promise(resolve => setTimeout(resolve, 100));
    const cancelled = window.phase3a.cancel();
    return { cancelled, outcome: await pending, pageResponsive: 1 + 1 === 2 };
  }, { provider, dtype });
} catch (error) {
  cancellation = { cancelled: false, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
}
clearInterval(sampler);
peakRssBytes = Math.max(peakRssBytes, await residentBytes(rootPid));

const report = {
  generatedAt: new Date().toISOString(),
  provider,
  dtype,
  runTimeoutMs,
  environment: {
    node: process.version,
    browser: await browser.version(),
    userAgent: await page.evaluate(() => navigator.userAgent),
    platform: await page.evaluate(() => navigator.platform),
    crossOriginIsolated: await page.evaluate(() => crossOriginIsolated),
  },
  webgpu,
  wallMs,
  memory: { baselineRssBytes, peakRssBytes, peakDeltaBytes: Math.max(0, peakRssBytes - baselineRssBytes), method: 'Chromium process-tree VmRSS sampled every 100ms' },
  progress,
  cancellation,
  run,
  runError,
};
await fs.writeFile(path.resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath: path.resolve(outputPath), provider, dtype, wallMs, runError, webgpu, memory: report.memory, cancellation }, null, 2));

if (timedOut) await browserServer.kill();
else {
  await context.close();
  await browser.close();
  await browserServer.close();
}
await vite.close();
if (runError) process.exitCode = 2;
