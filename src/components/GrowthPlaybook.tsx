import React, { useState } from 'react';
import { BookOpen, Zap, TrendingUp, Check, Copy } from 'lucide-react';
import { useLanguage } from '../i18n';

export const GrowthPlaybook: React.FC = () => {
  const { t, language } = useLanguage();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyRule = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{t('playbookHeaderTitle')}</h2>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-bold uppercase">
                {language === 'ko' ? '알고리즘 가이드' : 'Algorithm Standard'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('playbookHeaderSub')}
            </p>
          </div>
        </div>

        {/* Formula Bar */}
        <div className="mt-5 p-4 bg-slate-50 border border-gray-200 rounded-2xl text-center flex flex-col md:flex-row items-center justify-center gap-3 text-xs font-bold text-slate-700">
          <span className="text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100">
            {t('formulaRetention')}
          </span>
          <span className="text-slate-400 text-base">+</span>
          <span className="text-blue-700 bg-blue-50 px-3 py-1 rounded-xl border border-blue-100">
            {t('formulaShareability')}
          </span>
          <span className="text-slate-400 text-base">+</span>
          <span className="text-green-700 bg-green-50 px-3 py-1 rounded-xl border border-green-100">
            {t('formulaCTA')}
          </span>
          <span className="text-slate-400 text-base">=</span>
          <span className="text-slate-900 font-extrabold text-sm tracking-wide">
            {t('formulaResult')}
          </span>
        </div>
      </div>

      {/* Grid of Core Guidelines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* I. Anatomy of a Low-Skip Reel */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Zap className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">{t('rule1Title')}</h3>
          </div>

          <div className="space-y-4">
            {/* 1. Zero Second Hook */}
            <div className="bg-slate-50/70 border border-gray-100 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-indigo-700 uppercase tracking-wide">
                  {language === 'ko' ? '1. "0초" 스크롤 방지 훅 (0-3초)' : '1. The "Zero-Second" Hook (0-3 Seconds)'}
                </span>
                <button
                  onClick={() =>
                    copyRule(
                      language === 'ko'
                        ? '0초 훅 법칙: 즉각적인 화면 움직임 + 궁금증 유발 자막 + 0.0초 오디오 재생. 정적인 첫 화면 절대 금지!'
                        : 'Zero-Second Hook Rule: Visual Movement + Curiosity Gap Text + Immediate Audio (0 silence). Never start with static shot!',
                      'rule-1'
                    )
                  }
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  {copiedSection === 'rule-1' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                {language === 'ko' ? (
                  <>
                    <li><strong className="text-slate-900">시각적 움직임:</strong> 첫 프레임부터 빠른 역동적 움직임이나 조명 변화로 시작하세요. 멈춰있는 정적 구도는 이탈률을 높입니다.</li>
                    <li><strong className="text-slate-900">궁금증 유발 훅:</strong> "모르면 손해 보는 촬영 꿀팁...", "0원으로 해결한 방법" 등 도발적 자막을 상단에 제시하세요.</li>
                    <li><strong className="text-slate-900">즉각적 오디오:</strong> 0.0초에 정적이나 무음 없이 음성이 바로 시작되어야 합니다.</li>
                  </>
                ) : (
                  <>
                    <li><strong className="text-slate-900">Visual Movement:</strong> Start with fast motion or dramatic lighting change. Never start with a static shot!</li>
                    <li><strong className="text-slate-900">The "Curiosity Gap":</strong> On-screen text posing a bold claim ("The one tool that changed my setups forever...").</li>
                    <li><strong className="text-slate-900">Immediate Audio:</strong> Zero silence allowed at second 0.0.</li>
                  </>
                )}
              </ul>
            </div>

            {/* 2. Pattern Interrupt */}
            <div className="bg-slate-50/70 border border-gray-100 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-blue-700 uppercase tracking-wide">
                  {language === 'ko' ? '2. 화면 전환 & 자극 지속 (3-12초)' : '2. Pattern Interrupts (3-12 Seconds)'}
                </span>
                <button
                  onClick={() =>
                    copyRule(
                      language === 'ko'
                        ? '화면 전환 법칙: 1.5~2초마다 구도/줌/자막/효과음 전환. 0.3초 이상의 정적과 지루한 구간 전면 제거.'
                        : 'Pattern Interrupt Rule: Change visual/audio stimulus every 1.5-2s (angle, zoom, text pop-up, sound effect). Delete all micro-seconds of dead air.',
                      'rule-2'
                    )
                  }
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  {copiedSection === 'rule-2' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                {language === 'ko' ? (
                  <>
                    <li><strong className="text-slate-900">과감한 컷 편집:</strong> 1.5초~2초마다 화면 구도, 줌 인/아웃, 자막 팝업, 효과음 등으로 시각적 자극을 전환하세요.</li>
                    <li><strong className="text-slate-900">정적 구간 제거:</strong> 말 중간의 숨 소리나 0.3초 이상의 정적은 모두 잘라내세요.</li>
                    <li><strong className="text-slate-900">비주얼 스토리텔링:</strong> 말로만 설명하지 말고 B-roll 영상, 오버레이 이미지, 빠른 재생 연출을 활용하세요.</li>
                  </>
                ) : (
                  <>
                    <li><strong className="text-slate-900">Cut Relentlessly:</strong> Every 1.5 to 2 seconds, change the visual (camera angle, zoom, pop-up text, sound effect).</li>
                    <li><strong className="text-slate-900">Remove "Dead Air":</strong> Delete every micro-second of silence or inactivity.</li>
                    <li><strong className="text-slate-900">Visual Storytelling:</strong> Show, don't just tell. Use B-roll, overlays, and fast-forwarding for setup steps.</li>
                  </>
                )}
              </ul>
            </div>

            {/* 3. Loop & Payoff */}
            <div className="bg-slate-50/70 border border-gray-100 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                  {language === 'ko' ? '3. 루프 반복 & 결말 공개 (마지막 3초)' : '3. Loop & Payoff (Final 3 Seconds)'}
                </span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                {language === 'ko' ? (
                  <>
                    <li><strong className="text-slate-900">빠른 결과 공개:</strong> 지루하게 끌지 않고 10~20초 이내에 만족스러운 결말/결과물을 확실히 보여주세요.</li>
                    <li><strong className="text-slate-900">자연스러운 루프:</strong> 영상의 마지막 멘트나 화면이 0초의 첫 화면과 자연스럽게 이어지도록 연결하세요.</li>
                    <li><strong className="text-slate-900">재시청 유도:</strong> 빠르게 지나가는 자막이나 이스터에그 요소를 넣어 2회 이상 반복 시청을 유도하세요.</li>
                  </>
                ) : (
                  <>
                    <li><strong className="text-slate-900">The Big Reveal:</strong> Deliver satisfying result fast (within ~10-20s total).</li>
                    <li><strong className="text-slate-900">Seamless Looping:</strong> End video on a frame/sound that leads back into the start.</li>
                    <li><strong className="text-slate-900">Rewatch Trigger:</strong> Add fast text or subtle Easter egg to encourage a 2x rewatch.</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* II. Growth & Algorithmic Checklist */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-base font-bold text-slate-900">{t('rule2Title')}</h3>
          </div>

          <div className="space-y-4">
            {/* Unconnected Reach */}
            <div className="bg-slate-50/70 border border-gray-100 rounded-2xl p-4 space-y-2">
              <span className="font-bold text-xs text-green-700 uppercase tracking-wide block">
                {language === 'ko' ? '1. DM 공유 최적화 (비팔로워 도달의 핵심)' : '1. Optimize for Unconnected Reach (Shares / DMs)'}
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {language === 'ko'
                  ? '2026 인스타그램 알고리즘이 비팔로워 탐색 탭에 콘텐츠를 노출하는 1위 가중치는 바로 <strong className="text-slate-900">DM 전달(공유) 수</strong>입니다.'
                  : 'Instagram pushes content to non-followers primarily based on <strong className="text-slate-900">Shares (DMs)</strong>.'}
              </p>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                {language === 'ko' ? (
                  <>
                    <li><strong className="text-slate-900">공유하고 싶은 가치:</strong> 친구에게 보여주고 싶은 정보, 신기한 꿀팁, 공감 짤을 구성하세요.</li>
                    <li><strong className="text-slate-900">명확한 카테고리 설정:</strong> 첫 1초에 전문 분야를 각인시키세요 ("레고 촬영전문가", "조명 꿀팁").</li>
                  </>
                ) : (
                  <>
                    <li><strong className="text-slate-900">Relatability:</strong> Create saveable/shareable tips, struggles, or aesthetic mood clips.</li>
                    <li><strong className="text-slate-900">Niche Authority:</strong> Clearly define your niche in frame 1 ("LEGO Photography", "Lighting Expert").</li>
                  </>
                )}
              </ul>
            </div>

            {/* Technical Specs */}
            <div className="bg-slate-50/70 border border-gray-100 rounded-2xl p-4 space-y-2">
              <span className="font-bold text-xs text-indigo-700 uppercase tracking-wide block">
                {language === 'ko' ? '2. 알고리즘 규격 & 안전지대 수칙' : '2. Safe Zone & Technical Requirements'}
              </span>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                {language === 'ko' ? (
                  <>
                    <li><strong className="text-slate-900">타사 워터마크 금지:</strong> 틱톡, 캡컷 등 타 플랫폼 로고가 남아있으면 노출이 제한됩니다.</li>
                    <li><strong className="text-slate-900">1080p 고화질 렌더링:</strong> 4K 원본도 인스타그램 업로드 시 1080p, 30fps/60fps로 비트레이트 최적화하세요.</li>
                    <li><strong className="text-slate-900">UI 안전지대 준수:</strong> 하단 캡션 영역과 우측 반응 버튼(좋아요, 댓글, 공유)에 자막이 가려지지 않도록 중앙에 배치하세요.</li>
                  </>
                ) : (
                  <>
                    <li><strong className="text-slate-900">Zero Watermarks:</strong> Remove TikTok or third-party logos (heavily down-ranked).</li>
                    <li><strong className="text-slate-900">1080p Clean Export:</strong> Upload 1080x1920 (9:16) at 30/60fps.</li>
                    <li><strong className="text-slate-900">Safe Zones:</strong> Keep key text overlay away from bottom caption and right action icons.</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
