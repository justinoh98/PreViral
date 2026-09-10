import React from 'react';
import { Heart, MessageCircle, Send, Music, Eye, EyeOff, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../i18n';

interface SafeZoneOverlayProps {
  isVisible: boolean;
  onToggle: () => void;
  creatorHandle?: string;
  caption?: string;
}

export const SafeZoneOverlay: React.FC<SafeZoneOverlayProps> = ({
  isVisible,
  onToggle,
  creatorHandle = '@yourhandle',
  caption = '',
}) => {
  const { t, language } = useLanguage();

  const defaultCaption = language === 'ko'
    ? '릴스 캡션 미리보기가 여기에 표시됩니다...'
    : 'Your Reel caption preview will appear here...';

  const soundLabel = language === 'ko'
    ? '원본 오디오 • 트렌딩 음원'
    : 'Original Audio • Trending Sound';

  return (
    <>
      {/* This is positioned against the video card, not a separate small wrapper. */}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isVisible}
        className={`absolute top-3 right-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
          isVisible
            ? 'bg-rose-600 text-white ring-2 ring-rose-400'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
      >
        {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {isVisible ? t('safeZoneHide') : t('safeZoneShow')}
      </button>

      {/* Interactive Overlay Layer on top of video */}
      {isVisible && (
        <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 overflow-hidden rounded-xl border-2 border-dashed border-rose-500/60 bg-gradient-to-b from-black/20 via-transparent to-black/60">
          {/* Top Instagram Safe Bar */}
          <div className="flex justify-between items-center bg-rose-950/80 backdrop-blur-sm border border-rose-500/40 text-rose-200 text-[10px] font-bold px-2.5 py-1 rounded-md max-w-fit">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mr-1" />
            <span>{t('safeZoneTop')}</span>
          </div>

          {/* Center Safe Zone Box */}
          <div className="flex-1 my-8 border border-dashed border-emerald-400/50 rounded-lg flex items-center justify-center p-2 bg-emerald-500/5">
            <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-md text-[10px] font-bold text-emerald-300 border border-emerald-400/40 shadow-lg flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>{t('safeZoneCenter')}</span>
            </div>
          </div>

          {/* Right Side Action Bar Mockup */}
          <div className="absolute right-3 bottom-16 flex flex-col items-center gap-4 bg-slate-950/70 p-2 rounded-full border border-slate-700/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white">
                <Heart className="w-4 h-4 fill-slate-400 text-slate-400" />
              </div>
              <span className="text-[9px] font-bold text-slate-300">12.4k</span>
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white">
                <MessageCircle className="w-4 h-4 text-slate-300" />
              </div>
              <span className="text-[9px] font-bold text-slate-300">412</span>
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white">
                <Send className="w-4 h-4 text-slate-300" />
              </div>
              <span className="text-[9px] font-bold text-slate-300">2.1k</span>
            </div>

            <div className="w-7 h-7 rounded-full border-2 border-rose-500 bg-slate-900 flex items-center justify-center animate-spin">
              <Music className="w-3.5 h-3.5 text-rose-400" />
            </div>
          </div>

          {/* Bottom Caption & Audio Overlay Mockup */}
          <div className="mr-14 bg-slate-950/80 backdrop-blur-md border border-slate-800 p-2.5 rounded-lg text-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 to-rose-500 flex items-center justify-center text-[9px] font-black">
                IG
              </div>
              <span className="text-xs font-bold text-white">{creatorHandle}</span>
              <span className="text-[10px] font-bold bg-rose-600/80 text-white px-1.5 py-0.2 rounded">
                {t('safeZoneFollow')}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 line-clamp-2 leading-tight">
              {caption || defaultCaption}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400 font-medium">
              <Music className="w-3 h-3 text-rose-400" />
              <span>{soundLabel}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
