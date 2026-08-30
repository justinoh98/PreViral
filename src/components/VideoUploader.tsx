import React, { useState, useRef, useEffect } from 'react';
import { Upload, Film, Play, Pause, Sparkles, Check, AlertCircle, FileVideo, Music2, Tag, MessageSquare, RotateCcw, Lightbulb } from 'lucide-react';
import { getPresetReels } from '../data/presets';
import { PresetReel, ReelEvaluation } from '../types';
import { SafeZoneOverlay } from './SafeZoneOverlay';
import { useLanguage } from '../i18n';

interface VideoUploaderProps {
  onEvaluationComplete: (evaluation: ReelEvaluation) => void;
  isEvaluating: boolean;
  setIsEvaluating: (loading: boolean) => void;
  creatorHandle: string;
  defaultNiche: string;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onEvaluationComplete,
  isEvaluating,
  setIsEvaluating,
  creatorHandle,
  defaultNiche,
}) => {
  const { t, language } = useLanguage();
  const presetReels = getPresetReels(language);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
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

  const processSelectedFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(
        language === 'ko'
          ? '파일 크기가 최대 제한 용량인 2.5GB를 초과했습니다. 2.5GB 이하의 동영상을 업로드해주세요.'
          : 'File size exceeds the maximum allowed limit of 2.5GB. Please upload a video under 2.5GB.'
      );
      return;
    }
    setSelectedPreset(null);
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoTitle(file.name.replace(/\.[^/.]+$/, ''));
    setFileSizeMb(Number((file.size / (1024 * 1024)).toFixed(1)));
    const ext = file.name.split('.').pop()?.toUpperCase() || 'MP4';
    setFileFormat(ext);
  };

  // Handle Preset Reel Selection
  const handleSelectPreset = (preset: PresetReel) => {
    setSelectedPreset(preset);
    setVideoFile(null);
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

  // Extract base64 frame snapshots from video element for Gemini AI visual analysis
  const captureFrameSnapshots = (): string[] => {
    const snapshots: string[] = [];
    try {
      if (!videoRef.current || !canvasRef.current) return snapshots;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas || typeof canvas.getContext !== 'function') return snapshots;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        snapshots.push(canvas.toDataURL('image/jpeg', 0.8));
      }
    } catch (err) {
      console.warn('Could not capture video frame snapshot:', err);
    }
    return snapshots;
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

    try {
      const frameSnapshots = captureFrameSnapshots();

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

      const response = await fetch('/api/evaluate-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: videoTitle || (language === 'ko' ? '업로드된 릴스' : 'Uploaded Reel'),
          durationSeconds: duration,
          fileFormat,
          fileSizeMb,
          niche,
          captionInput,
          videoConcept,
          audioType,
          frameSnapshots,
          hasWatermark: false,
          detectedAudioSilence: false,
          language,
        }),
      });

      const evaluationData: ReelEvaluation = await response.json();
      onEvaluationComplete(evaluationData);
    } catch (err) {
      console.error('Failed to evaluate reel:', err);
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
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 hover:border-indigo-500 bg-slate-50/70 hover:bg-slate-50 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all group min-h-[320px]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.avi,.webm,.mkv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                <FileVideo className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">
                {t('dragDropTitle')} <span className="text-indigo-600 underline">{t('browseFile')}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">{t('dragDropSub')}</p>
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
              disabled={isEvaluating || (!videoUrl && !selectedPreset)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
            >
              {isEvaluating ? (
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
