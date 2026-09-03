import React, { useState, useRef, useEffect } from 'react';
import { Upload, Film, Play, Pause, Sparkles, Check, AlertCircle, FileVideo, Music2, Tag, MessageSquare, RotateCcw, Lightbulb, ShieldCheck } from 'lucide-react';
import { getPresetReels } from '../data/presets';
import { PresetReel, ReelEvaluation } from '../types';
import { SafeZoneOverlay } from './SafeZoneOverlay';
import { useLanguage } from '../i18n';
import { createLocalEvaluation, VideoMetrics } from '../localFallback';

interface VideoUploaderProps {
  onEvaluationComplete: (evaluation: ReelEvaluation) => void;
  onVideoIdentityChange: () => void;
  isEvaluating: boolean;
  setIsEvaluating: (loading: boolean) => void;
  creatorHandle: string;
  defaultNiche: string;
}

const EVALUATION_CACHE_VERSION = 8;

interface StoredEvaluation {
  scoringVersion: number;
  videoContentHash: string;
  evaluation: ReelEvaluation;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onEvaluationComplete,
  onVideoIdentityChange,
  isEvaluating,
  setIsEvaluating,
  creatorHandle,
  defaultNiche,
}) => {
  const { t, language } = useLanguage();
  const presetReels = getPresetReels(language);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoContentHash, setVideoContentHash] = useState<string>('');
  const [isFingerprinting, setIsFingerprinting] = useState<boolean>(false);
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [duration, setDuration] = useState<number>(15);
  const [fileFormat, setFileFormat] = useState<string>('MP4');
  const [fileSizeMb, setFileSizeMb] = useState<number>(12);
  const [niche, setNiche] = useState<string>(defaultNiche || 'Toys & Hobbies');
  const [captionInput, setCaptionInput] = useState<string>('');
  const [videoConcept, setVideoConcept] = useState<string>('');
  const [audioType, setAudioType] = useState<string>('Trending Audio (Upbeat synth loop)');
  const [selectedPreset, setSelectedPreset] = useState<PresetReel | null>(null);

  // Sync selected preset when language changes
  useEffect(() => {
    if (selectedPreset) {
      const matching = presetReels.find((p) => p.id === selectedPreset.id);
      if (matching) {
        setSelectedPreset(matching);
        setVideoTitle(matching.title);
        setCaptionInput(matching.preComputedEvaluation.captionInput || '');
        setVideoConcept(matching.preComputedEvaluation.videoConcept || '');
        setAudioType(matching.preComputedEvaluation.audioType);
      }
    }
  }, [language]);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showSafeZone, setShowSafeZone] = useState<boolean>(false);
  const [evalProgressText, setEvalProgressText] = useState<string>(
    language === 'ko' ? '영상 매개변수 분석 중...' : 'Analyzing video parameters...'
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileSelectionRef = useRef<number>(0);

  const checksumTable = useRef<Uint32Array | null>(null);

  const getChecksumTable = () => {
    if (checksumTable.current) return checksumTable.current;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let value = n;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }
      table[n] = value >>> 0;
    }
    checksumTable.current = table;
    return table;
  };

  // Reads every byte without loading the whole video into memory. File names and
  // timestamps are deliberately excluded, so renaming an unchanged video keeps
  // its original evaluation while any byte-level edit creates a new identity.
  const createContentFingerprint = async (file: File) => {
    const table = getChecksumTable();
    const reader = file.stream().getReader();
    let crc = 0xffffffff;
    let fnv = 0x811c9dc5;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (let index = 0; index < value.length; index += 1) {
        const byte = value[index];
        crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
        fnv = Math.imul(fnv ^ byte, 0x01000193) >>> 0;
      }
    }

    return `${file.size}-${((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')}-${fnv.toString(16).padStart(8, '0')}`;
  };

  const createEvaluationCacheKey = async (contentHash: string) => {
    const context = JSON.stringify({
      scoringVersion: EVALUATION_CACHE_VERSION,
      contentHash,
    });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(context));
    return `previral:evaluation:v${EVALUATION_CACHE_VERSION}:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  };

  const readExactMatchEvaluation = (cacheKey: string, contentHash: string) => {
    const cachedValue = localStorage.getItem(cacheKey);
    if (!cachedValue) return null;

    try {
      const stored = JSON.parse(cachedValue) as StoredEvaluation;
      if (
        stored.scoringVersion !== EVALUATION_CACHE_VERSION ||
        stored.videoContentHash !== contentHash ||
        !stored.evaluation
      ) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      return stored.evaluation;
    } catch {
      localStorage.removeItem(cacheKey);
      return null;
    }
  };

  const storeEvaluation = (cacheKey: string, contentHash: string, evaluation: ReelEvaluation) => {
    const stored: StoredEvaluation = {
      scoringVersion: EVALUATION_CACHE_VERSION,
      videoContentHash: contentHash,
      evaluation: { ...evaluation, isCachedEvaluation: false },
    };
    localStorage.setItem(cacheKey, JSON.stringify(stored));
  };

  // Device media is requested only after an explicit user action. The browser's
  // native picker grants access only to the file the user selects.
  const openMediaPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle local video file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      processSelectedFile(file);
    }
  };

  const MAX_FILE_SIZE_BYTES = 2.5 * 1024 * 1024 * 1024; // 2.5GB

  const processSelectedFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(
        language === 'ko'
          ? '파일 크기가 최대 제한 용량인 2.5GB를 초과했습니다. 2.5GB 이하의 동영상을 업로드해주세요.'
          : 'File size exceeds the maximum allowed limit of 2.5GB. Please upload a video under 2.5GB.'
      );
      return;
    }
    const selectionId = ++fileSelectionRef.current;
    onVideoIdentityChange();
    setSelectedPreset(null);
    setVideoTitle('');
    setVideoContentHash('');
    setIsFingerprinting(true);
    setVideoFile(file);
    if (videoUrl?.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoTitle(file.name.replace(/\.[^/.]+$/, ''));
    setFileSizeMb(Number((file.size / (1024 * 1024)).toFixed(1)));
    const ext = file.name.split('.').pop()?.toUpperCase() || 'MP4';
    setFileFormat(ext);
    try {
      const fingerprint = await createContentFingerprint(file);
      if (fileSelectionRef.current === selectionId) setVideoContentHash(fingerprint);
    } catch (error) {
      console.warn('Could not fingerprint the selected video:', error);
      if (fileSelectionRef.current === selectionId) {
        setVideoContentHash('');
        alert(
          language === 'ko'
            ? '영상 동일성을 정확히 확인할 수 없습니다. 파일을 다시 선택해 주세요.'
            : 'The video could not be verified for an exact match. Please select the file again.'
        );
      }
    } finally {
      if (fileSelectionRef.current === selectionId) setIsFingerprinting(false);
    }
  };

  // Handle Preset Reel Selection
  const handleSelectPreset = (preset: PresetReel) => {
    setSelectedPreset(preset);
    setVideoFile(null);
    setVideoContentHash(`preset:${preset.id}`);
    setVideoUrl(preset.videoUrl);
    setVideoTitle(preset.title);
    setDuration(preset.duration);
    setFileFormat(preset.format.split(' ')[0]);
    setFileSizeMb(14.5);
    setNiche(preset.niche);
    setCaptionInput(preset.preComputedEvaluation.captionInput || '');
    setVideoConcept(preset.preComputedEvaluation.videoConcept || '');
    setAudioType(preset.preComputedEvaluation.audioType);
  };

  // Video metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = Math.round(videoRef.current.duration || 15);
      setDuration(dur);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Deep temporal scan: dense opening coverage plus full-timeline sampling.
  const analyzeVideoFrames = async (): Promise<{ frameSnapshots: string[]; videoMetrics?: VideoMetrics }> => {
    const snapshots: string[] = [];
    try {
      if (!videoRef.current || !canvasRef.current) return { frameSnapshots: snapshots };
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState < 1) {
        await new Promise<void>((resolve) => video.addEventListener('loadedmetadata', () => resolve(), { once: true }));
      }
      const sourceWidth = video.videoWidth || 640;
      const sourceHeight = video.videoHeight || 360;
      canvas.width = 160;
      canvas.height = Math.max(90, Math.round(160 * sourceHeight / sourceWidth));
      const ctx = canvas.getContext('2d');
      if (!ctx) return { frameSnapshots: snapshots };

      const wasPaused = video.paused;
      const originalTime = video.currentTime;
      video.pause();
      const durationValue = Math.max(0.1, video.duration || duration || 1);
      const uniformCount = Math.min(60, Math.max(18, Math.ceil(durationValue / 0.75) + 1));
      const openingTimes = [0.02, 0.15, 0.35, 0.6, 0.9, 1.3, 1.8, 2.4, 3].filter((time) => time < durationValue);
      const uniformTimes = Array.from({ length: uniformCount }, (_, index) =>
        0.02 + ((durationValue - 0.07) * index) / Math.max(1, uniformCount - 1)
      );
      const sampleTimes = [...new Set([...openingTimes, ...uniformTimes].map((time) => Number(time.toFixed(3))))]
        .sort((left, right) => left - right)
        .slice(0, 68);
      const luminanceFrames: Uint8Array[] = [];
      const contrastValues: number[] = [];
      const brightnessValues: number[] = [];
      const sharpnessValues: number[] = [];
      const colorfulnessValues: number[] = [];
      const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

      for (const [index, sampleTime] of sampleTimes.entries()) {
        const target = Math.min(Math.max(0, sampleTime), Math.max(0, durationValue - 0.05));
        if (Math.abs(video.currentTime - target) > 0.02) {
          await new Promise<void>((resolve) => {
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              resolve();
            };
            video.addEventListener('seeked', finish, { once: true });
            video.currentTime = target;
            window.setTimeout(finish, 1200);
          });
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const luminance = new Uint8Array(canvas.width * canvas.height);
        let sum = 0;
        let saturationSum = 0;
        for (let pixel = 0, point = 0; pixel < pixels.length; pixel += 4, point += 1) {
          const red = pixels[pixel];
          const green = pixels[pixel + 1];
          const blue = pixels[pixel + 2];
          const value = Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722);
          luminance[point] = value;
          sum += value;
          const maximum = Math.max(red, green, blue);
          const minimum = Math.min(red, green, blue);
          saturationSum += maximum === 0 ? 0 : (maximum - minimum) / maximum;
        }
        const mean = sum / luminance.length;
        let variance = 0;
        let edgeDifference = 0;
        let edgeSamples = 0;
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            const point = y * canvas.width + x;
            variance += (luminance[point] - mean) ** 2;
            if (x > 0) { edgeDifference += Math.abs(luminance[point] - luminance[point - 1]); edgeSamples += 1; }
            if (y > 0) { edgeDifference += Math.abs(luminance[point] - luminance[point - canvas.width]); edgeSamples += 1; }
          }
        }
        luminanceFrames.push(luminance);
        brightnessValues.push(mean / 255 * 100);
        contrastValues.push(Math.min(100, Math.sqrt(variance / luminance.length) / 64 * 100));
        sharpnessValues.push(Math.min(100, edgeDifference / Math.max(1, edgeSamples) / 32 * 100));
        colorfulnessValues.push(Math.min(100, saturationSum / luminance.length * 125));
        const snapshotStride = Math.max(1, Math.floor(sampleTimes.length / 8));
        if (index % snapshotStride === 0 || index === sampleTimes.length - 1) snapshots.push(canvas.toDataURL('image/jpeg', 0.82));
      }

      const frameDifference = (left: Uint8Array, right: Uint8Array) => {
        let difference = 0;
        for (let index = 0; index < left.length; index += 1) difference += Math.abs(left[index] - right[index]);
        return difference / left.length / 255 * 100;
      };
      const differences = luminanceFrames.slice(1).map((frame, index) => frameDifference(luminanceFrames[index], frame));
      const earlyCount = Math.max(2, sampleTimes.filter((time) => time <= 3).length);
      const earlyDifference = average(differences.slice(0, earlyCount - 1));
      const payoffDifference = average(differences.slice(-Math.max(2, Math.ceil(differences.length * 0.15))));
      const startEndDifference = frameDifference(luminanceFrames[0], luminanceFrames[luminanceFrames.length - 1]);
      const brightnessMean = average(brightnessValues);
      const brightnessDeviation = Math.sqrt(average(brightnessValues.map((value) => (value - brightnessMean) ** 2)));
      const videoMetrics: VideoMetrics = {
        width: sourceWidth,
        height: sourceHeight,
        motionScore: Math.round(Math.min(100, average(differences) * 5)),
        contrastScore: Math.round(average(contrastValues)),
        brightnessScore: Math.round(brightnessMean),
        loopSimilarityScore: Math.round(Math.max(0, 100 - startEndDifference * 4)),
        earlyMotionScore: Math.round(Math.min(100, earlyDifference * 6)),
        changeFrequencyScore: Math.round(differences.filter((value) => value >= 2.2).length / Math.max(1, differences.length) * 100),
        payoffChangeScore: Math.round(Math.min(100, payoffDifference * 6)),
        sceneCutScore: Math.round(Math.min(100, differences.filter((value) => value >= 8).length / Math.max(1, differences.length) * 300)),
        staticFrameRatio: Math.round(differences.filter((value) => value < 1.15).length / Math.max(1, differences.length) * 100),
        sharpnessScore: Math.round(average(sharpnessValues)),
        colorfulnessScore: Math.round(average(colorfulnessValues)),
        exposureStabilityScore: Math.round(Math.max(0, 100 - brightnessDeviation * 3)),
        blackFrameRatio: Math.round(brightnessValues.filter((value) => value < 8).length / Math.max(1, brightnessValues.length) * 100),
        sampledFrames: luminanceFrames.length,
      };

      video.currentTime = originalTime;
      if (!wasPaused) void video.play();
      return { frameSnapshots: snapshots.slice(0, 9), videoMetrics };
    } catch (err) {
      console.warn('Could not complete deep video scan:', err);
    }
    return { frameSnapshots: snapshots };
  };

  // Trigger Reel Evaluation
  const handleEvaluate = async () => {
    if (selectedPreset) {
      setIsEvaluating(true);
      setEvalProgressText(
        language === 'ko' ? '샘플 릴스 데이터 추출 중...' : 'Extracting preset analysis...'
      );
      setTimeout(() => {
        setIsEvaluating(false);
        onEvaluationComplete(selectedPreset.preComputedEvaluation);
      }, 1200);
      return;
    }

    if (!videoUrl && !videoFile) return;

    setIsEvaluating(true);
    setEvalProgressText(
      language === 'ko'
        ? '0-3초 시청 이탈 방지 훅 & 비주얼 대비 스캔 중...'
        : 'Scanning 0-3s Zero-Second Hook & visual contrast...'
    );

    let analyzedMetrics: VideoMetrics | undefined;
    try {
      const { frameSnapshots, videoMetrics } = await analyzeVideoFrames();
      analyzedMetrics = videoMetrics;

      setTimeout(
        () =>
          setEvalProgressText(
            language === 'ko'
              ? '컷 전환 주기 & 이탈 유발 정적 구간 진단 중...'
              : 'Checking cut frequency & dead air intervals...'
          ),
        800
      );
      setTimeout(
        () =>
          setEvalProgressText(
            language === 'ko'
              ? '스토리 구조 & 빠른 결말 피날레 평가 중...'
              : 'Evaluating narrative arc & fast payoff delivery...'
          ),
        1600
      );
      setTimeout(
        () =>
          setEvalProgressText(
            language === 'ko'
              ? '인스타그램 UI 안전지대 & 루프 연결성 검증 중...'
              : 'Checking Instagram UI safe zones & loop transition...'
          ),
        2400
      );

      const auditInput = {
        title: videoTitle || (language === 'ko' ? '업로드된 릴스' : 'Uploaded Reel'),
        durationSeconds: duration,
        fileFormat,
        fileSizeMb,
        niche,
        captionInput,
        videoConcept,
        audioType,
        videoContentHash: videoContentHash || `preset:${selectedPreset?.id || 'unknown'}`,
        videoMetrics,
        language,
      };

      const cacheKey = await createEvaluationCacheKey(auditInput.videoContentHash);
      const cachedEvaluation = readExactMatchEvaluation(cacheKey, auditInput.videoContentHash);
      if (cachedEvaluation) {
        onEvaluationComplete({
          ...cachedEvaluation,
          title: auditInput.title,
          isCachedEvaluation: true,
        });
        return;
      }
      const response = await fetch('/api/evaluate-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...auditInput,
          frameSnapshots,
          hasWatermark: false,
          detectedAudioSilence: false,
          language,
        }),
      });

      const evaluationData: ReelEvaluation = response.ok
        ? await response.json()
        : createLocalEvaluation(auditInput);
      const freshEvaluation = { ...evaluationData, isCachedEvaluation: false };
      storeEvaluation(cacheKey, auditInput.videoContentHash, freshEvaluation);
      onEvaluationComplete(freshEvaluation);
    } catch (err) {
      const evaluationData = createLocalEvaluation({
        title: videoTitle || (language === 'ko' ? '업로드된 릴스' : 'Uploaded Reel'),
        durationSeconds: duration,
        fileFormat,
        fileSizeMb,
        niche,
        captionInput,
        videoConcept,
        audioType,
        videoContentHash,
        videoMetrics: analyzedMetrics,
        language,
      });
      if (videoContentHash) {
        const cacheKey = await createEvaluationCacheKey(videoContentHash);
        storeEvaluation(cacheKey, videoContentHash, evaluationData);
      }
      onEvaluationComplete({ ...evaluationData, isCachedEvaluation: false });
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm text-slate-800">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header section with Preset quick launcher */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Upload className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">{t('uploaderHeaderTitle')}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{t('uploaderHeaderSub')}</p>
        </div>

        {/* Preset Reel Quick Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{t('trySample')}</span>
          <select
            onChange={(e) => {
              const p = presetReels.find((item) => item.id === e.target.value);
              if (p) handleSelectPreset(p);
            }}
            value={selectedPreset?.id || ''}
            className="bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-60"
          >
            <option value="" disabled>
              {t('selectSample')}
            </option>
            {presetReels.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.title} ({preset.duration}s)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Dropzone & Video Player */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {!videoUrl ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-200 hover:border-indigo-500 bg-slate-50/70 hover:bg-slate-50 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all group min-h-[320px]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
                aria-label={t('browseMedia')}
              />
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                <FileVideo className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">{t('dragDropTitle')}</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">{t('dragDropSub')}</p>
              <button
                type="button"
                onClick={openMediaPicker}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <FileVideo className="h-4 w-4" />
                {t('browseMedia')}
              </button>
              <p className="mt-3 flex max-w-sm items-start justify-center gap-1.5 text-[11px] leading-relaxed text-slate-500">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                <span>{t('mediaPermissionNotice')}</span>
              </p>
              <div className="flex items-center gap-2 mt-4 text-[11px] text-slate-500 font-medium flex-wrap justify-center">
                <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" /> {t('check1080p')}</span>
                <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" /> {t('checkHook')}</span>
                <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" /> {t('checkSafeZone')}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Video Player Card */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-xl group">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full max-h-[380px] object-contain mx-auto"
                  playsInline
                  loop
                />

                {/* Safe Zone Interactive Overlay */}
                <SafeZoneOverlay
                  isVisible={showSafeZone}
                  onToggle={() => setShowSafeZone(!showSafeZone)}
                  creatorHandle={creatorHandle}
                  caption={captionInput}
                />

                {/* Play/Pause Overlay Controls */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <button
                    onClick={togglePlay}
                    className="w-14 h-14 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-105 pointer-events-auto"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </button>
                </div>

                {/* Video Info Pill */}
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-slate-800 border border-gray-200/80 flex items-center gap-2 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span>{duration} {t('seconds')}</span>
                  <span className="text-slate-400">•</span>
                  <span>{fileFormat}</span>
                </div>
              </div>

              {/* Action Toolbar below player */}
              <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                  {videoTitle || (language === 'ko' ? '업로드된 릴스' : 'Uploaded Reel')} ({fileSizeMb} MB)
                </span>
                <button
                  onClick={() => {
                    setVideoUrl(null);
                    setVideoFile(null);
                    setVideoContentHash('');
                    setVideoTitle('');
                    onVideoIdentityChange();
                    setSelectedPreset(null);
                    setVideoConcept('');
                  }}
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('changeVideo')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Metadata & Details Inputs */}
        <div className="lg:col-span-6 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            {/* Title / Reel Name */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                {t('reelTitleLabel')}
              </label>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder={t('reelTitlePlaceholder')}
                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Target Niche */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-indigo-600" /> {t('nicheLabel')}
              </label>
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Photography">
                  {language === 'ko' ? '사진 & 포토그래피' : 'Photography'}
                </option>
                <option value="Toys & Hobbies">
                  {language === 'ko' ? '토이 & 취미' : 'Toys & Hobbies'}
                </option>
                <option value="Music & Movie">
                  {language === 'ko' ? '음악 & 영화' : 'Music & Movie'}
                </option>
                <option value="Tech & Gadgets">
                  {language === 'ko' ? '전자기기 & IT장비' : 'Tech & Gadgets'}
                </option>
                <option value="Fitness & Sports">
                  {language === 'ko' ? '피트니스 & 스포츠' : 'Fitness & Sports'}
                </option>
                <option value="Food & Recipe Prep">
                  {language === 'ko' ? '요리 & 쿠킹 레시피' : 'Food & Recipe Prep'}
                </option>
                <option value="Fashion & Lifestyle">
                  {language === 'ko' ? '패션 & 라이프스타일' : 'Fashion & Lifestyle'}
                </option>
                <option value="Education & Informatives">
                  {language === 'ko' ? '교육 & 정보' : 'Education & Informatives'}
                </option>
                <option value="Travel & Aesthetic Vlogs">
                  {language === 'ko' ? '여행 & 감성 브이로그' : 'Travel & Aesthetic Vlogs'}
                </option>
                <option value="Business & Entrepreneurship">
                  {language === 'ko' ? '비즈니스 & 동기부여' : 'Business & Entrepreneurship'}
                </option>
              </select>
            </div>

            {/* Caption & Hook Prompt */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" /> {t('captionLabel')}
              </label>
              <textarea
                value={captionInput}
                onChange={(e) => setCaptionInput(e.target.value)}
                placeholder={t('captionPlaceholder')}
                rows={2}
                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Video Concept & Creative Intent (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> {t('conceptLabel')}
                </label>
                <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-md">
                  {t('conceptOptionalBadge')}
                </span>
              </div>
              <textarea
                value={videoConcept}
                onChange={(e) => setVideoConcept(e.target.value)}
                placeholder={t('conceptPlaceholder')}
                rows={2}
                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
              <p className="text-[11px] text-slate-500 mt-1 leading-normal flex items-start gap-1">
                <span>💡</span>
                <span>{t('conceptHelper')}</span>
              </p>
            </div>

            {/* Audio Track Type */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Music2 className="w-3.5 h-3.5 text-indigo-600" /> {t('audioTypeLabel')}
              </label>
              <select
                value={audioType}
                onChange={(e) => setAudioType(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Trending Audio (Upbeat synth loop)">
                  {language === 'ko' ? '트렌딩 오디오 (노출 알고리즘 우대)' : 'Trending Audio (High reach boost)'}
                </option>
                <option value="Instagram-Featured Music (Catalog music, non-trending)">
                  {language === 'ko' ? '인스타그램 추천 음원 (일반 음원)' : 'Instagram-Featured Music (Instagram library, non-trending)'}
                </option>
                <option value="Original Voiceover & ASMR">
                  {language === 'ko' ? '오리지널 음성 / ASMR' : 'Original Voiceover & ASMR'}
                </option>
                <option value="Original Music / Sound Track">
                  {language === 'ko' ? '자체 제작 음악 트랙' : 'Original Music Track'}
                </option>
                <option value="Silent / Dialogue Only">
                  {language === 'ko' ? '무음 / 대사 전용 (자막 시청 모드)' : 'Silent / Voice Only (Sound Off watch mode)'}
                </option>
              </select>
            </div>
          </div>

          {/* Evaluate Button */}
          <div className="pt-2">
            <button
              onClick={handleEvaluate}
              disabled={isEvaluating || isFingerprinting || (!videoUrl && !selectedPreset) || (!selectedPreset && !videoContentHash)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
            >
              {isFingerprinting ? (
                <><RotateCcw className="w-4 h-4 animate-spin" /> {language === 'ko' ? '영상 변경 여부 확인 중...' : 'Checking video identity...'}</>
              ) : isEvaluating ? (
                <>
                  <Sparkles className="w-5 h-5 animate-spin" />
                  <span>{evalProgressText}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>{t('btnRunEval')}</span>
                </>
              )}
            </button>
            {!videoUrl && !selectedPreset ? (
              <p className="text-[11px] text-slate-500 text-center mt-2 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> {t('uploadPrompt')}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 text-center mt-2.5 flex items-center justify-center gap-1.5 leading-tight px-2">
                <span className="text-amber-600 font-semibold text-xs">⚠️</span>
                <span>{t('aiDisclaimerShort')}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
