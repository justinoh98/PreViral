import React from 'react';
import { Film, BarChart3, BookOpen, History, Upload, Sparkles, UserCheck, Globe } from 'lucide-react';
import { useLanguage, Language } from '../i18n';

interface NavbarProps {
  activeTab: 'eval' | 'analytics' | 'playbook' | 'history';
  setActiveTab: (tab: 'eval' | 'analytics' | 'playbook' | 'history') => void;
  creatorHandle: string;
  setCreatorHandle: (handle: string) => void;
  creatorNiche: string;
  onOpenUpload: () => void;
  auditCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  creatorHandle,
  setCreatorHandle,
  creatorNiche,
  onOpenUpload,
  auditCount,
}) => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 text-slate-800 py-2.5 sm:py-3 transition-all">
      <div className="app-shell flex flex-col xl:flex-row items-center justify-between gap-2.5 sm:gap-3">
        {/* Logo & Brand */}
        <div className="flex items-center gap-2 sm:gap-3 w-full xl:w-auto justify-between xl:justify-start min-w-0">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('eval')}>
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-100">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base sm:text-lg tracking-tight uppercase text-slate-900 whitespace-nowrap">
                  {t('brandName')} <span className="text-indigo-600">AI</span>
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                  {t('engineTag')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                {t('brandTagline')}
              </p>
            </div>
          </div>

          {/* Top Right Mobile Controls */}
          <div className="xl:hidden flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-slate-100 px-1.5 sm:px-2 py-1 rounded-xl border border-slate-200">
              <Globe className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer w-16 sm:w-auto"
              >
                <option value="en">English</option>
                <option value="ko">한국어 (Korean)</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 px-2 sm:px-2.5 py-1 rounded-full border border-slate-200 text-xs text-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <input
                type="text"
                value={creatorHandle}
                onChange={(e) => setCreatorHandle(e.target.value)}
                className="bg-transparent border-none text-xs font-semibold focus:outline-none w-14 sm:w-20 text-slate-800"
                placeholder={t('handlePlaceholder')}
              />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 w-full xl:w-auto overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActiveTab('eval')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'eval'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="mobile-hide-label">{t('tabAnalyzer')}</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="mobile-hide-label">{t('tabAnalytics')}</span>
          </button>

          <button
            onClick={() => setActiveTab('playbook')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'playbook'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="mobile-hide-label">{t('tabPlaybook')}</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap relative ${
              activeTab === 'history'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="mobile-hide-label">{t('tabHistory')}</span>
            {auditCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-extrabold">
                {auditCount}
              </span>
            )}
          </button>
        </nav>

        {/* Desktop Creator Handle, Upload CTA & Top-Right Language Option Bar */}
        <div className="hidden xl:flex items-center gap-3">
          {/* Top Right Language Option Bar */}
          <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-xl border border-slate-200/80 transition-colors">
            <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
              title="Language Option / 언어 선택"
            >
              <option value="en">English</option>
              <option value="ko">한국어 (Korean)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <div className="flex flex-col">
              <input
                type="text"
                value={creatorHandle}
                onChange={(e) => setCreatorHandle(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none w-28"
                placeholder={t('handlePlaceholder')}
              />
              <span className="text-[10px] text-slate-500 font-medium truncate max-w-[110px]">
                {creatorNiche}
              </span>
            </div>
          </div>

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Upload className="w-4 h-4" />
            {t('uploadNew')}
          </button>
        </div>
      </div>
    </header>
  );
};
