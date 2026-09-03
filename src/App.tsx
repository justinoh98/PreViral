import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { VideoUploader } from './components/VideoUploader';
import { EvaluationResults } from './components/EvaluationResults';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { GrowthPlaybook } from './components/GrowthPlaybook';
import { getPresetReels } from './data/presets';
import { ReelEvaluation } from './types';
import { LanguageProvider, useLanguage } from './i18n';
import { Sparkles, History, Upload, FileText, ArrowRight } from 'lucide-react';

function AppContent() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'eval' | 'analytics' | 'playbook' | 'history'>('eval');
  const [creatorHandle, setCreatorHandle] = useState<string>('@legitbricks_');
  const [creatorNiche, setCreatorNiche] = useState<string>('Toys & Hobbies');

  const initialPresets = getPresetReels(language);

  // Pre-seed with preset evaluation data for instant interactive testing
  const [history, setHistory] = useState<ReelEvaluation[]>([
    initialPresets[0].preComputedEvaluation,
    initialPresets[1].preComputedEvaluation,
    initialPresets[2].preComputedEvaluation,
  ]);

  const [currentEvaluation, setCurrentEvaluation] = useState<ReelEvaluation | null>(
    initialPresets[0].preComputedEvaluation
  );
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Update preset data in history and currentEvaluation when language changes
  useEffect(() => {
    const localizedPresets = getPresetReels(language);
    setHistory((prev) =>
      prev.map((item) => {
        const match = localizedPresets.find((p) => p.preComputedEvaluation.id === item.id);
        return match ? match.preComputedEvaluation : item;
      })
    );

    setCurrentEvaluation((prev) => {
      if (!prev) return null;
      const match = localizedPresets.find((p) => p.preComputedEvaluation.id === prev.id);
      return match ? match.preComputedEvaluation : prev;
    });
  }, [language]);

  const handleEvaluationComplete = (evaluation: ReelEvaluation) => {
    setCurrentEvaluation(evaluation);
    // Add to history if not already present
    setHistory((prev) => {
      const exists = prev.find((item) => item.id === evaluation.id);
      if (exists) {
        return prev.map((item) => (item.id === evaluation.id ? evaluation : item));
      }
      return [evaluation, ...prev];
    });
    setActiveTab('eval');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        creatorHandle={creatorHandle}
        setCreatorHandle={setCreatorHandle}
        creatorNiche={creatorNiche}
        onOpenUpload={() => {
          setActiveTab('eval');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        auditCount={history.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* VIEW 1: Evaluation Lab */}
        {activeTab === 'eval' && (
          <div className="space-y-8">
            {/* Always-open Video Submission Function */}
            <VideoUploader
              onEvaluationComplete={handleEvaluationComplete}
              onVideoIdentityChange={() => setCurrentEvaluation(null)}
              isEvaluating={isEvaluating}
              setIsEvaluating={setIsEvaluating}
              creatorHandle={creatorHandle}
              defaultNiche={creatorNiche}
            />

            {/* Evaluation Results Dashboard */}
            {currentEvaluation && (
              <EvaluationResults
                evaluation={currentEvaluation}
                onReEvaluate={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </div>
        )}

        {/* VIEW 2: Real-Time Analytics Dashboard */}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            history={history}
            onSelectReel={(reel) => {
              setCurrentEvaluation(reel);
              setActiveTab('eval');
            }}
          />
        )}

        {/* VIEW 3: 2026 Growth Playbook */}
        {activeTab === 'playbook' && <GrowthPlaybook />}

        {/* VIEW 4: Saved Audits Log */}
        {activeTab === 'history' && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" /> {t('historyTitle')}
                </h2>
                <p className="text-xs text-slate-500">
                  {t('historySub')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((reel) => (
                <div
                  key={reel.id}
                  onClick={() => {
                    setCurrentEvaluation(reel);
                    setActiveTab('eval');
                  }}
                  className="bg-slate-50 border border-gray-100 hover:border-indigo-300 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-bold uppercase">
                        {reel.niche}
                      </span>
                      <span className="text-amber-500 font-bold text-sm">
                        {reel.overallStars.toFixed(1)} ★
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {reel.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t('durationLabel')}: {reel.durationSeconds}s • {t('skipRateLabel')}: <span className="text-green-600 font-bold">{reel.expectedSkipRatePercent}%</span>
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-indigo-600 font-bold">
                    <span>{t('viewEvaluation')}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Reel Evaluator © 2026 • {language === 'ko' ? '인스타그램 크리에이터를 위한 시청 지속률 & 성장 연구소' : 'High-Retention & Growth Lab for Instagram Creators'}</span>
          <span className="text-slate-400">Built for @{creatorHandle.replace('@', '')}</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
