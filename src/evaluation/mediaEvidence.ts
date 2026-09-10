import { EVIDENCE_VERSION, type MediaEvidence, type Frame } from '../../evaluation/contracts';

export function sampleTimes(duration: number): number[] {
  const last = Math.max(0, duration - .025);
  // Reserve part of the 96-frame budget for detected transitions.
  const count = Math.min(64, Math.max(32, Math.ceil(duration / .6) + 1));
  return [...new Set([0, .1, .25, .5, .8, 1.2, 1.7, 2.3, 3, ...Array.from({ length: count }, (_, i) => last * i / (count - 1))]
    .filter(t => t <= last).map(t => Number(t.toFixed(3))))].sort((a, b) => a - b);
}
export function scanTimes(duration: number): number[] {
  const count = Math.min(240, Math.max(2, Math.ceil(duration / .25) + 1));
  return Array.from({ length: count }, (_, i) => Number(((duration - .025) * i / (count - 1)).toFixed(3)));
}
export function frameDifference(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length || !a.length) return 0;
  let total = 0;
  for (let i = 0; i < a.length; i += 4) total += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  return total / (a.length / 4 * 3 * 255);
}
export function selectSceneChangeTimes(base: number[], changes: Array<{ before: number; after: number; difference: number }>, duration: number): number[] {
  const selected = [...base];
  for (const change of [...changes].filter(c => c.difference >= .12).sort((a, b) => b.difference - a.difference || a.after - b.after)) {
    for (const time of [change.before, change.after]) {
      if (selected.length < 96 && time >= 0 && time <= duration - .025 && !selected.some(t => Math.abs(t - time) < .035)) selected.push(time);
    }
  }
  return selected.sort((a, b) => a - b);
}
function waitFor(video: HTMLVideoElement, event: string, action: () => void, timeout = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); video.removeEventListener(event, done); video.removeEventListener('error', error); };
    const done = () => { cleanup(); resolve(); };
    const error = () => { cleanup(); reject(new Error('The video could not be decoded. Please use a playable MP4 or WebM export.')); };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('A video frame could not be decoded in time. Please retry with a smaller export.')); }, timeout);
    video.addEventListener(event, done, { once: true }); video.addEventListener('error', error, { once: true });
    action();
  });
}
async function audioEvidence(file: File | null): Promise<Pick<MediaEvidence, 'audioStatus' | 'audioWav' | 'audioUnavailableReason'>> {
  if (!file) return { audioStatus: 'unavailable', audioUnavailableReason: 'No local audio file was available.' };
  if (file.size > 64 * 1024 * 1024) return { audioStatus: 'unavailable', audioUnavailableReason: 'Audio extraction currently supports files up to 64 MB.' };
  if (!window.AudioContext) return { audioStatus: 'unavailable', audioUnavailableReason: 'This browser does not support local audio decoding.' };
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration > 300) return { audioStatus: 'unavailable', audioUnavailableReason: 'The decoded audio exceeds five minutes.' };
    const rate = 16000;
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
    const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);
    if (!samples.some(n => Math.abs(n) > .0001)) return { audioStatus: 'absent' };
    const data = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(data);
    const word = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    word(0, 'RIFF'); view.setUint32(4, data.byteLength - 8, true); word(8, 'WAVE'); word(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    word(36, 'data'); view.setUint32(40, samples.length * 2, true);
    samples.forEach((n, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, n)) * (n < 0 ? 32768 : 32767), true));
    const audioWav = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(new Blob([data], { type: 'audio/wav' }));
    });
    return { audioStatus: 'provided', audioWav };
  } catch { return { audioStatus: 'unavailable', audioUnavailableReason: 'The audio track could not be decoded in this browser; speech and sound remain unknown.' }; }
  finally { await context.close(); }
}

export async function captureMediaEvidence(url: string, file: File | null, onProgress: (progress: number) => void): Promise<MediaEvidence> {
  const video = document.createElement('video'); video.preload = 'auto'; video.muted = true; video.playsInline = true;
  try {
    await waitFor(video, 'loadeddata', () => { video.src = url; video.load(); });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 300) throw new Error('Video review currently supports playable Reels up to five minutes.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser could not read the video images.');
    // Audio decoding is independent of frame seeking; start it now so it overlaps visual work.
    const audioPromise = audioEvidence(file);
    const frames: Frame[] = [];
    // Small images locate candidate changes only. They never become quality/pacing measurements.
    const scan = document.createElement('canvas'); scan.width = 48; scan.height = 48;
    const scanContext = scan.getContext('2d', { willReadFrequently: true });
    const changes: Array<{ before: number; after: number; difference: number }> = [];
    let prior: Uint8ClampedArray | null = null;
    let priorTime = 0;
    const probes = scanTimes(video.duration);
    if (scanContext) for (const [index, time] of probes.entries()) {
      if (Math.abs(video.currentTime - time) > .001) await waitFor(video, 'seeked', () => { video.currentTime = time; });
      if (video.readyState < 2 || Math.abs(video.currentTime - time) > .04) throw new Error('A video section could not be decoded accurately. Please retry.');
      scanContext.drawImage(video, 0, 0, 48, 48);
      const pixels = scanContext.getImageData(0, 0, 48, 48).data;
      if (prior) changes.push({ before: priorTime, after: time, difference: frameDifference(prior, pixels) });
      prior = pixels; priorTime = time;
      onProgress(.35 * (index + 1) / probes.length);
    }
    const times = selectSceneChangeTimes(sampleTimes(video.duration), changes, video.duration);
    for (const [index, time] of times.entries()) {
      if (Math.abs(video.currentTime - time) > .001) await waitFor(video, 'seeked', () => { video.currentTime = time; });
      if (video.readyState < 2 || Math.abs(video.currentTime - time) > .04) throw new Error('A section of the Reel could not be captured accurately. Please retry.');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({ id: `frame-${index + 1}`, timeSec: Number(video.currentTime.toFixed(3)), imageUrl: canvas.toDataURL('image/jpeg', .86) });
      onProgress(.35 + .65 * (index + 1) / times.length);
    }
    const audio = await audioPromise;
    return { version: EVIDENCE_VERSION, durationSeconds: video.duration, width: video.videoWidth, height: video.videoHeight, frames, samplingMode: scanContext ? 'adaptive' : 'uniform', ...audio };
  } finally { video.pause(); video.removeAttribute('src'); video.load(); }
}
