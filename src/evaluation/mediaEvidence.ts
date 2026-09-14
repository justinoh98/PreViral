import { EVIDENCE_VERSION, type MediaEvidence, type Frame, type AudioAnalysis } from '../../evaluation/contracts';
import { analyzeAudioSamples, analyzeVisualFrames, selectRepresentativeTimes, unavailableAudioAnalysis, type PixelFrame } from '../../evaluation/mediaAnalysis';
import { capabilityReport } from '../../evaluation/capabilities';
import { evidenceId } from '../../evaluation/evidence';

export function sampleTimes(duration: number): number[] {
  const last = Math.max(0, duration - .025);
  // Reserve part of the 96-frame budget for detected transitions.
  const count = Math.min(64, Math.max(32, Math.ceil(duration / .6) + 1));
  return [...new Set([0, .1, .25, .5, .8, 1.2, 1.7, 2.3, 3, ...Array.from({ length: count }, (_, i) => last * i / (count - 1))]
    .filter(t => t <= last).map(t => Number(t.toFixed(3))))].sort((a, b) => a - b);
}
export function measurementTimes(duration: number): number[] {
  const last = Math.max(0, duration - .025);
  const fullDuration = Array.from({ length: Math.floor(last / .25) + 1 }, (_, index) => index * .25);
  const denseOpening = Array.from({ length: Math.floor(Math.min(3, last) / .1) + 1 }, (_, index) => index * .1);
  return [...new Set([...fullDuration, ...denseOpening, last].map(time => Number(time.toFixed(3))))].sort((a, b) => a - b);
}

export const scanTimes = measurementTimes;
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
type AudioCapture = Pick<MediaEvidence, 'audioStatus' | 'audioWav' | 'audioUnavailableReason'> & { analysis: AudioAnalysis };
async function audioEvidence(file: File | null, sourceFingerprint: string): Promise<AudioCapture> {
  if (!file) {
    const reason = 'No local audio file was available.';
    return { audioStatus: 'unavailable', audioUnavailableReason: reason, analysis: unavailableAudioAnalysis(reason) };
  }
  if (file.size > 64 * 1024 * 1024) {
    const reason = 'Audio extraction currently supports files up to 64 MB to avoid retaining a large compressed video in memory.';
    return { audioStatus: 'unavailable', audioUnavailableReason: reason, analysis: unavailableAudioAnalysis(reason) };
  }
  if (!window.AudioContext) {
    const reason = 'This browser does not support local audio decoding.';
    return { audioStatus: 'unavailable', audioUnavailableReason: reason, analysis: unavailableAudioAnalysis(reason) };
  }
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration > 300) {
      const reason = 'The decoded audio exceeds five minutes.';
      return { audioStatus: 'unavailable', audioUnavailableReason: reason, analysis: unavailableAudioAnalysis(reason) };
    }
    const rate = 16000;
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
    const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);
    const analysis = analyzeAudioSamples(samples, rate, sourceFingerprint);
    if (analysis.trackState === 'absent') return { audioStatus: 'absent', analysis };
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
    return { audioStatus: 'provided', audioWav, analysis };
  } catch {
    const reason = 'The audio track could not be decoded in this browser; speech and sound remain unknown.';
    return { audioStatus: 'unavailable', audioUnavailableReason: reason, analysis: unavailableAudioAnalysis(reason) };
  }
  finally { await context.close(); }
}

export async function captureMediaEvidence(url: string, file: File | null, sourceFingerprint: string, onProgress: (progress: number) => void): Promise<MediaEvidence> {
  if (!/^sha256-[a-f0-9]{64}$/.test(sourceFingerprint)) throw new Error('A full-content SHA-256 fingerprint is required before analysis.');
  const video = document.createElement('video'); video.preload = 'auto'; video.muted = true; video.playsInline = true;
  try {
    await waitFor(video, 'loadeddata', () => { video.src = url; video.load(); });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 300) throw new Error('Video review currently supports playable Reels up to five minutes.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser could not read the video images.');
    const measurementCanvas = document.createElement('canvas'); measurementCanvas.width = 48; measurementCanvas.height = 48;
    const measurementContext = measurementCanvas.getContext('2d', { willReadFrequently: true });
    if (!measurementContext) throw new Error('This browser could not measure the decoded video images.');
    // Audio decoding overlaps the single full-duration measurement pass.
    const audioPromise = audioEvidence(file, sourceFingerprint);
    const pixelFrames: PixelFrame[] = [];
    const probes = measurementTimes(video.duration);
    for (const [index, time] of probes.entries()) {
      if (Math.abs(video.currentTime - time) > .001) await waitFor(video, 'seeked', () => { video.currentTime = time; });
      if (video.readyState < 2 || Math.abs(video.currentTime - time) > .04) throw new Error('A video section could not be decoded accurately. Please retry.');
      measurementContext.drawImage(video, 0, 0, 48, 48);
      pixelFrames.push({ id: evidenceId('measurement', index + 1, time, undefined, sourceFingerprint), timeSec: time, width: 48, height: 48, pixels: measurementContext.getImageData(0, 0, 48, 48).data });
      onProgress(.7 * (index + 1) / probes.length);
    }
    const analysis = analyzeVisualFrames(pixelFrames, video.duration, sourceFingerprint);
    const times = selectRepresentativeTimes(analysis, video.duration);
    const frames: Frame[] = [];
    for (const [index, time] of times.entries()) {
      if (Math.abs(video.currentTime - time) > .001) await waitFor(video, 'seeked', () => { video.currentTime = time; });
      if (video.readyState < 2 || Math.abs(video.currentTime - time) > .04) throw new Error('A section of the Reel could not be captured accurately. Please retry.');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({ id: evidenceId('frame', index + 1, time, undefined, sourceFingerprint), timeSec: Number(video.currentTime.toFixed(3)), imageUrl: canvas.toDataURL('image/jpeg', .86) });
      onProgress(.7 + .3 * (index + 1) / times.length);
    }
    const audio = await audioPromise;
    analysis.audio = audio.analysis;
    analysis.capabilities = capabilityReport({ audioDecode: audio.analysis.trackState !== 'unavailable', ocr: false, localSemantics: false, remoteSemantics: false });
    analysis.firstFrame.id = frames[0].id;
    analysis.endingFrame.id = frames.at(-1)!.id;
    analysis.startEndSimilarity.evidenceIds = [frames[0].id, frames.at(-1)!.id];
    for (const shot of analysis.shots) {
      const measurement = analysis.measurements.find(row => row.id === shot.representativeMeasurementId)!;
      shot.representativeFrameId = frames.reduce((closest, frame) => Math.abs(frame.timeSec - measurement.timeSec) < Math.abs(closest.timeSec - measurement.timeSec) ? frame : closest, frames[0]).id;
    }
    const { analysis: _audioAnalysis, ...audioPayload } = audio;
    return { version: EVIDENCE_VERSION, durationSeconds: video.duration, width: video.videoWidth, height: video.videoHeight, frames, samplingMode: 'adaptive', sourceFingerprint, analysis, ...audioPayload };
  } finally { video.pause(); video.removeAttribute('src'); video.load(); }
}
