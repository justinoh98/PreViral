import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { BarChart3, TrendingUp, Zap, Award, History, FileText } from 'lucide-react';
import { ReelEvaluation } from '../types';
import { StarRating } from './StarRating';
import { useLanguage } from '../i18n';

interface AnalyticsDashboardProps {
  history: ReelEvaluation[];
  onSelectReel: (reel: ReelEvaluation) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  history,
  onSelectReel,
}) => {
  const { t, language } = useLanguage();
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Format data for trends line chart
  const trendData = history.map((item, idx) => ({
    name: item.title ? item.title.slice(0, 14) + '...' : `Reel #${idx + 1}`,
    stars: item.overallStars,
    skipRate: item.expectedSkipRatePercent,
    growthPotential: item.followerGrowthPotentialPercent,
    date: new Date(item.timestamp).toLocaleDateString(language === 'ko' ? 'ko-KR' : undefined, {
      month: 'short',
      day: 'numeric',
    }),
  }));

  // Aspect comparison bar data
  const latestReel = history[0];
  const aspectData = latestReel
    ? [
        { aspect: language === 'ko' ? '0-3초 훅' : 'Hook (0-3s)', stars: latestReel.aspects.hookStrength.stars },
        { aspect: language === 'ko' ? '편집 속도' : 'Pacing', stars: latestReel.aspects.pacingAndStimulation.stars },
        { aspect: language === 'ko' ? '스토리 결말' : 'Payoff Arc', stars: latestReel.aspects.narrativeAndPayoff.stars },
        { aspect: language === 'ko' ? '루프 연결성' : 'Loopability', stars: latestReel.aspects.loopingAndRetention.stars },
        { aspect: language === 'ko' ? '기술 규격' : 'Technical', stars: latestReel.aspects.technicalCompliance.stars },
      ]
    : [];

  const handleToggleCompare = (id: string) => {
    if (compareIds.includes(id)) {
      setCompareIds(compareIds.filter((item) => item !== id));
    } else {
      if (compareIds.length >= 2) {
        setCompareIds([compareIds[1], id]);
      } else {
        setCompareIds([...compareIds, id]);
      }
    }
  };

  const getVerdictLabel = (verdict: string) => {
    if (language !== 'ko') return verdict;
    switch (verdict) {
      case 'Viral Contender':
        return '바이럴 후보';
      case 'Strong Growth':
        return '우수한 성장세';
      case 'Moderate Retention':
        return '보통 수준 유지';
      case 'High Skip Risk':
        return '높은 이탈 위험';
      default:
        return verdict;
    }
  };

  const reel1 = history.find((h) => h.id === compareIds[0]);
  const reel2 = history.find((h) => h.id === compareIds[1]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">{t('analyticsTitle')}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t('analyticsSub')}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold bg-slate-50 px-4 py-2.5 rounded-2xl border border-gray-200">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">{t('totalEvaluated')}</span>
            <span className="text-slate-900 font-extrabold text-base">{history.length} {language === 'ko' ? '개' : 'Reels'}</span>
          </div>
          <div className="h-6 w-px bg-gray-200" />
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">{t('avgQualityScore')}</span>
            <span className="text-amber-500 font-extrabold text-base">
              {history.length > 0
                ? (history.reduce((acc, curr) => acc + curr.overallStars, 0) / history.length).toFixed(1)
                : '0.0'}
              ★
            </span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Quality & Skip Rate Performance Trend Chart */}
        <div className="lg:col-span-8 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" /> {t('chartTrendTitle')}
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">
              {language === 'ko' ? '업로드 이력 기준' : 'Historical Uploads'}
            </span>
          </div>

          <div className="h-64 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis yAxisId="left" domain={[0, 5]} stroke="#d97706" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#4f46e5" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}
                    labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="stars"
                    name={language === 'ko' ? '알고리즘 평점 (0-5점)' : 'Star Rating (0-5)'}
                    stroke="#d97706"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="skipRate"
                    name={language === 'ko' ? '이탈률 % (낮을수록 우수)' : 'Skip Rate % (Lower = Better)'}
                    stroke="#4f46e5"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs font-semibold">
                {language === 'ko' ? '릴스를 업로드하면 성과 추이 그래프가 생성됩니다.' : 'Upload reels to generate performance trend line charts.'}
              </div>
            )}
          </div>
        </div>

        {/* Latest Reel Aspect Ratings Breakdown */}
        <div className="lg:col-span-4 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> {t('chartAspectTitle')}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {latestReel ? latestReel.title : (language === 'ko' ? '업로드된 릴스 없음' : 'No uploads yet')}
            </p>
          </div>

          <div className="h-56 w-full">
            {aspectData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aspectData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 5]} stroke="#64748b" fontSize={11} />
                  <YAxis type="category" dataKey="aspect" stroke="#334155" fontSize={10} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px' }}
                  />
                  <Bar dataKey="stars" fill="#4f46e5" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs font-semibold">
                {language === 'ko' ? '분석 데이터가 아직 없습니다.' : 'No aspect data available yet.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Drawer Modal / Section */}
      {compareIds.length === 2 && reel1 && reel2 && (
        <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 shadow-md space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600" /> {t('compareTitle')}
            </h3>
            <button
              onClick={() => setCompareIds([])}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              {t('compareClose')}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Reel 1 */}
            <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">
                  {language === 'ko' ? '버전 A' : 'Version A'} ({reel1.versionTag || 'v1'})
                </span>
                <StarRating rating={reel1.overallStars} size="sm" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">{reel1.title}</h4>
              <div className="text-xs space-y-1 text-slate-700">
                <div>
                  {t('expectedSkipRate')}: <span className="font-bold text-indigo-600">{reel1.expectedSkipRatePercent}%</span>
                </div>
                <div>
                  {language === 'ko' ? '팔로워 도달:' : 'Follower Reach:'} <span className="font-bold text-slate-800">{reel1.followerGrowthPotentialPercent}%</span>
                </div>
              </div>
            </div>

            {/* Reel 2 */}
            <div className="bg-slate-50 border border-green-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-green-700">
                  {language === 'ko' ? '버전 B' : 'Version B'} ({reel2.versionTag || 'v2'})
                </span>
                <StarRating rating={reel2.overallStars} size="sm" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">{reel2.title}</h4>
              <div className="text-xs space-y-1 text-slate-700">
                <div>
                  {t('expectedSkipRate')}:{' '}
                  <span className="font-bold text-green-600">
                    {reel2.expectedSkipRatePercent}%
                  </span>{' '}
                  ({reel2.expectedSkipRatePercent < reel1.expectedSkipRatePercent
                    ? (language === 'ko' ? `-${reel1.expectedSkipRatePercent - reel2.expectedSkipRatePercent}% 감소` : `-${reel1.expectedSkipRatePercent - reel2.expectedSkipRatePercent}% drop`)
                    : (language === 'ko' ? '동일' : 'same')})
                </div>
                <div>
                  {language === 'ko' ? '팔로워 도달:' : 'Follower Reach:'} <span className="font-bold text-slate-800">{reel2.followerGrowthPotentialPercent}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" /> {t('historyTableTitle')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('historyTableSub')}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-200">
              <tr>
                <th className="p-3">{language === 'ko' ? '비교 선택' : 'Compare'}</th>
                <th className="p-3">{language === 'ko' ? '릴스 제목' : 'Reel Title'}</th>
                <th className="p-3">{language === 'ko' ? '분야' : 'Niche'}</th>
                <th className="p-3">{language === 'ko' ? '알고리즘 평점' : 'Star Rating'}</th>
                <th className="p-3">{language === 'ko' ? '예상 이탈률' : 'Skip Rate'}</th>
                <th className="p-3">{language === 'ko' ? '도달 잠재력' : 'Reach Potential'}</th>
                <th className="p-3">{language === 'ko' ? '평가 결과' : 'Verdict'}</th>
                <th className="p-3 text-right">{language === 'ko' ? '리포트' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((reel) => {
                const isCompared = compareIds.includes(reel.id);
                return (
                  <tr key={reel.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isCompared}
                        onChange={() => handleToggleCompare(reel.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 bg-white"
                      />
                    </td>
                    <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <div>{reel.title}</div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {reel.durationSeconds}{language === 'ko' ? '초' : 's'} • {reel.fileFormat}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-500">{reel.niche}</td>
                    <td className="p-3 font-bold text-amber-500">
                      <StarRating rating={reel.overallStars} size="sm" showNumeric={true} />
                    </td>
                    <td className="p-3 font-bold text-slate-800">
                      <span className={reel.expectedSkipRatePercent <= 20 ? 'text-green-600' : 'text-amber-600'}>
                        {reel.expectedSkipRatePercent}%
                      </span>
                    </td>
                    <td className="p-3 font-bold text-indigo-600">{reel.followerGrowthPotentialPercent}%</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-gray-200">
                        {getVerdictLabel(reel.overallVerdict)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onSelectReel(reel)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                      >
                        {language === 'ko' ? '리포트 보기' : 'View Report'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
