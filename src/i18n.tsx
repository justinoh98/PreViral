import React, { createContext, useContext, useState } from 'react';

export type Language = 'en' | 'ko';

export const getInitialLanguage = (): Language => {
  if (typeof window !== 'undefined' && window.navigator) {
    const lang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
    if (lang.startsWith('ko')) {
      return 'ko';
    }
  }
  return 'en';
};

export const translations = {
  en: {
    // Brand & Navbar
    brandName: 'PreViral',
    engineTag: '2026 Engine',
    brandTagline: 'Instagram Retention & High-Reach Optimizer',
    tabAnalyzer: 'Analyzer',
    tabAnalytics: 'Performance Trends',
    tabPlaybook: 'Guidebook',
    tabHistory: 'Saved Audits',
    uploadNew: 'Upload New Version',
    handlePlaceholder: '@yourhandle',

    // Uploader
    uploaderHeaderTitle: 'Video Submission & Reel Evaluator',
    uploaderHeaderSub: 'Upload any Reel format (MP4, MOV, AVI) for instant 2026 algorithm & retention evaluation',
    trySample: 'Try Sample Reel:',
    selectSample: 'Select sample video reel...',
    dragDropTitle: 'Choose a Reel video from your device',
    browseFile: 'Browse File',
    browseMedia: 'Choose from device media',
    mediaPermissionNotice: 'PreViral opens your media only after you tap this button. It can access only the video you select; canceling grants no access.',
    dragDropSub: 'Supports all major video formats: MP4, MOV, AVI, WEBM, MKV (up to 2.5GB).',
    check1080p: '1080p Quality Analysis',
    checkHook: '0-3s Hook Check',
    checkSafeZone: 'Safe Zone Scan',
    seconds: 'seconds',
    changeVideo: 'Change Video',
    reelTitleLabel: 'Reel Title / Version Name',
    reelTitlePlaceholder: 'e.g. Spider-Man LEGO BTS v1',
    nicheLabel: 'Target Niche',
    captionLabel: 'Planned Caption & On-Screen Hook',
    captionPlaceholder: 'Type your planned caption or on-screen hook text (e.g. "How I shot this with a $0 budget...")',
    conceptLabel: 'Video Concept & Creative Intent',
    conceptOptionalBadge: 'Optional',
    conceptPlaceholder: 'Briefly describe the storyline, key message, or creative concept of this Reel (e.g. "Behind-the-scenes showing a 1-second lighting trick that transforms flat footage into cinematic neon glow")',
    conceptHelper: 'Provides clear context so AI generates A-to-Z hooks, captions, and CTAs tailored to your exact intended portrayal.',
    audioTypeLabel: 'Audio Track Type',
    btnRunEval: 'Run 2026 AI Reel Evaluation',
    btnEvaluating: 'Analyzing Reel...',
    uploadPrompt: 'Upload a video or pick a sample reel above to evaluate.',

    // Evaluation Results
    overallScoreLabel: 'Overall Score:',
    outOf5: 'Out of 5.0',
    reEvaluateTest: 'Re-Evaluate / Test Edit',
    generateCaptionsBtn: 'Generate Viral Captions',
    defectsTitle: 'Objective Algorithm & Retention Defects Identified',
    expectedSkipRate: 'Expected Skip Rate',
    lowSkipOptimal: 'Low Skip (Optimal)',
    moderateSkipRisk: 'Moderate Skip Risk',
    reachForecast: 'Reach Forecast',
    potential: 'Potential',
    nonFollowerInterest: 'Non-Follower Interest',
    starsMax: '/ 5.0 Stars',
    dmSendFactor: 'DM Send Factor',
    shareRate: 'Share Rate',

    aspectMatrixTitle: 'Critical Aspect 5-Star Evaluation Matrix',
    aspectMatrixSub: 'Detailed 0-5 star breakdown across the 5 core 2026 growth pillars',
    avgCutFreq: 'Avg Cut Frequency:',
    deadAirDetected: 'Dead Air Detected:',
    setupDuration: 'Setup Duration:',
    payoffDelivery: 'Payoff Delivery:',
    loopContinuity: 'Loop Continuity:',
    rewatchTrigger: 'Rewatch Trigger:',
    resolutionLabel: 'Resolution:',
    watermarkLabel: 'Watermark:',
    safeZonesLabel: 'Safe Zones:',
    captionsLabel: 'Captions:',

    playbookTitle: 'Stance-by-Stance On-Screen Text & Hook Playbook',
    playbookBadge: 'Caption Breakdown Guidance',
    playbookDesc: 'Because no caption or on-screen text hook was provided, your video was analyzed period-by-period. Select and copy text hook options and duration-based placement guidance for each stance window:',
    optionADirect: 'Option A (Direct Value)',
    optionBCuriosity: 'Option B (Curiosity Gap)',
    optionCStory: 'Option C (Story / Bold Stance)',
    onScreenGuidanceLabel: 'On-Screen Guidance per Duration Period:',

    actionableEditsTitle: 'Actionable Editing Guidelines & Fixes',
    actionableEditsSub: 'Specific timestamped adjustments to maximize retention and drop skip rate',
    suggestedEdits: 'Suggested Edits',
    fixLabel: 'fix',
    solutionLabel: 'Solution:',
    copyFix: 'Copy Fix',
    copied: 'Copied',

    captionOptimizerTitle: 'Caption & CTA Growth Optimizer',
    captionOptimizerSub: 'Designed to turn non-follower viewers into long-term followers via active CTAs',
    recommendedHooks: 'Recommended On-Screen Text Hooks',
    valueCTA: 'Value-Based CTA',
    cliffhangerCTA: 'Cliffhanger CTA',
    commentBait: 'Comment Bait Question',
    recommendedHashtags: 'Recommended High-Reach Hashtags:',
    copyCompletePackage: 'Copy Complete Package',
    copiedFullPackage: 'Copied Full Caption',

    modalTitle: '2026 AI Viral Caption Generator',
    modalSub: 'Generate custom hooks, comment baits, and CTAs tailored specifically for your reel topic.',
    topicLabel: 'Reel Topic / Concept',
    topicPlaceholder: 'e.g. 3 secret camera moves for cinematic videos',
    btnGenerateHooks: 'Generate Hooks & Captions',
    btnGeneratingHooks: 'Generating Hooks...',
    generatedHooksLabel: 'Generated Hooks',

    // SafeZone
    safeZoneHide: 'Hide Instagram UI Safe Zone',
    safeZoneShow: 'Overlay IG Safe Zone Guides',
    safeZoneTop: 'Top Safe Margin (110px) - Avoid top text',
    safeZoneCenter: 'Optimal Safe Zone for Text & Hook Callouts',
    safeZoneFollow: 'Follow',

    // Analytics Dashboard
    analyticsTitle: 'Real-Time Performance Analytics',
    analyticsSub: 'Track evaluation metrics, skip rate reductions, and growth trends across all uploaded Reels',
    totalEvaluated: 'Total Evaluated',
    avgQualityScore: 'Avg Quality Score',
    chartTrendTitle: 'Overall Quality Score & Skip Rate Trend',
    chartAspectTitle: 'Latest Reel Aspect Breakdown',
    compareTitle: 'A/B Version Comparison Matrix',
    compareClose: 'Close Comparison',
    historyTableTitle: 'Audited Reels Log & History',
    historyTableSub: 'Click any reel to review full evaluation report or select 2 reels to compare',

    // Growth Playbook
    playbookHeaderTitle: '2026 High-Retention & Growth Formula',
    playbookHeaderSub: 'The exact framework to stop the scroll, lower skip rates, and convert non-followers into followers',
    formulaRetention: 'High Retention (Hook + Pacing)',
    formulaShareability: 'High Shareability (DM Sends)',
    formulaCTA: 'Active CTA',
    formulaResult: 'Viral Growth & Non-Follower Reach',
    rule1Title: 'I. Anatomy of a Low-Skip Reel',
    rule2Title: 'II. Unconnected Reach & Technical Rules',

    // Saved Audits History
    historyTitle: 'Saved Audits & Iteration Log',
    historySub: 'Select an audited reel to review its 5-star rating breakdown and actionable edit guidelines',
    viewEvaluation: 'View Evaluation',
    durationLabel: 'Duration',
    skipRateLabel: 'Skip Rate',

    // Disclaimer
    aiDisclaimerTitle: 'Disclaimer & Advisory Notice',
    aiDisclaimer: 'Please note: AI evaluations and algorithm predictions are directional estimates to guide your creative workflow and may make mistakes. Always test and adapt based on your specific audience and real-world performance.',
    aiDisclaimerShort: 'AI analysis is an advisory guide and may make mistakes. Use as a reference alongside your creative judgment.',
  },
  ko: {
    // Brand & Navbar
    brandName: 'PreViral',
    engineTag: '2026 엔진',
    brandTagline: '인스타그램 시청 지속률 & 노출 최적화 솔루션',
    tabAnalyzer: '릴스 분석기',
    tabAnalytics: '트렌드 리포트',
    tabPlaybook: '성장 가이드북',
    tabHistory: '진단 기록함',
    uploadNew: '새 릴스 진단하기',
    handlePlaceholder: '@계정아이디',

    // Uploader
    uploaderHeaderTitle: '동영상 업로드 & AI 릴스 진단',
    uploaderHeaderSub: '게시 전 릴스(MP4, MOV 등)를 업로드하여 2026 알고리즘 반응과 시청 이탈률을 정밀 진단받으세요',
    trySample: '예시 릴스 체험:',
    selectSample: '예시 샘플 릴스 선택...',
    dragDropTitle: '기기에서 릴스 동영상을 선택하세요',
    browseFile: '파일 찾아보기',
    browseMedia: '기기 미디어에서 선택',
    mediaPermissionNotice: '이 버튼을 누른 후 직접 선택한 영상만 PreViral이 열 수 있습니다. 선택을 취소하면 어떤 미디어에도 접근하지 않습니다.',
    dragDropSub: '모든 주요 비디오 포맷 지원: MP4, MOV, AVI, WEBM, MKV (최대 2.5GB)',
    check1080p: '1080p 고화질 정밀 분석',
    checkHook: '0-3초 훅 구간 검증',
    checkSafeZone: '안전지대 가이드 적용',
    seconds: '초',
    changeVideo: '영상 변경',
    reelTitleLabel: '릴스 제목 / 버전 이름',
    reelTitlePlaceholder: '예: 레고 스파이더맨 촬영 비하인드 v1',
    nicheLabel: '타겟 카테고리 / 분야',
    captionLabel: '게시할 캡션 & 상단 자막 문구',
    captionPlaceholder: '게시할 캡션이나 화면 자막 문구를 입력하세요 (예: 0원으로 고화질 연출하는 법...)',
    conceptLabel: '릴스 핵심 컨셉 및 기획 의도',
    conceptOptionalBadge: '선택 사항',
    conceptPlaceholder: '영상의 기획 의도, 전개 스토리, 연출 분위기나 핵심 메시지를 자유롭게 적어주세요 (예: "조명 세팅 실수로 칙칙했던 영상을 1초 만에 네온 시네마틱 무드로 바꾸는 비하인드 꿀팁")',
    conceptHelper: '입력 시 기획 의도와 연출 방향에 100% 부합하는 A to Z 맞춤형 훅, 캡션, CTA 가이드를 한층 더 정밀하게 생성합니다.',
    audioTypeLabel: '오디오 트랙 유형',
    btnRunEval: '2026 AI 릴스 정밀 진단 실행',
    btnEvaluating: '릴스 알고리즘 분석 진행 중...',
    uploadPrompt: '영상을 업로드하거나 상단에서 예시 릴스를 선택해 진단을 시작하세요.',

    // Evaluation Results
    overallScoreLabel: '알고리즘 평점:',
    outOf5: '5.0점 만점 기준',
    reEvaluateTest: '다시 진단 / 수정안 테스트',
    generateCaptionsBtn: '바이럴 캡션 생성하기',
    defectsTitle: '알고리즘 & 시청 이탈 결함 항목',
    expectedSkipRate: '예상 이탈률',
    lowSkipOptimal: '낮은 이탈률 (최적)',
    moderateSkipRisk: '높은 이탈 위험',
    reachForecast: '알고리즘 도달 예측',
    potential: '도달 잠재력',
    nonFollowerInterest: '비팔로워 유입도',
    starsMax: '/ 5.0점',
    dmSendFactor: 'DM 공유 및 전달 지수',
    shareRate: '공유 반응도',

    aspectMatrixTitle: '5대 핵심 성장 요소 정밀 진단',
    aspectMatrixSub: '2026년 인스타그램 알고리즘의 5가지 핵심 기둥별 0-5점 평가',
    avgCutFreq: '평균 컷 전환 주기:',
    deadAirDetected: '이탈 유발 정적 구간:',
    setupDuration: '도입부 길이:',
    payoffDelivery: '결말 공개 시점:',
    loopContinuity: '루프 연결성:',
    rewatchTrigger: '재시청 유도 요소:',
    resolutionLabel: '해상도:',
    watermarkLabel: '워터마크:',
    safeZonesLabel: '안전지대 적용:',
    captionsLabel: '자막 상태:',

    playbookTitle: '구간별 화면 자막 & 훅 연출 가이드',
    playbookBadge: '자막 미입력 보완 가이드',
    playbookDesc: '게시용 캡션이나 자막 문구가 입력되지 않아 릴스 구성을 구간별로 분석했습니다. 각 구간별 추천 훅 문구와 연출 위치 가이드를 참고하세요:',
    optionADirect: '옵션 A (직관적 가치 제공형)',
    optionBCuriosity: '옵션 B (호기심 유발형)',
    optionCStory: '옵션 C (강렬한 대립/스토리형)',
    onScreenGuidanceLabel: '구간별 화면 연출 및 자막 위치 가이드:',

    actionableEditsTitle: '바로 적용 가능한 편집 개선안',
    actionableEditsSub: '시청 이탈을 줄이고 알고리즘 도달을 극대화하기 위한 타임스탬프별 편집 가이드',
    suggestedEdits: '개의 권장 편집안',
    fixLabel: '수정',
    solutionLabel: '해결책:',
    copyFix: '수정안 복사',
    copied: '복사됨',

    captionOptimizerTitle: '캡션 & 성장 패키지 최적화',
    captionOptimizerSub: '시청자를 장기 팔로워로 전환하기 위한 행동 유도(CTA) 및 해시태그 패키지',
    recommendedHooks: '화면 상단 추천 자막 훅',
    valueCTA: '가치 기반 CTA',
    cliffhangerCTA: '궁금증 유발 CTA',
    commentBait: '댓글 참여 유도 질문',
    recommendedHashtags: '추천 고도달 해시태그:',
    copyCompletePackage: '전체 패키지 복사',
    copiedFullPackage: '전체 패키지 복사완료',

    modalTitle: '2026 AI 바이럴 캡션 생성기',
    modalSub: '릴스 주제에 딱 맞는 맞춤형 훅, 댓글 참여 유도 문구, CTA를 자동 생성합니다.',
    topicLabel: '릴스 주제 / 아이디어',
    topicPlaceholder: '예: 영화 같은 연출을 만드는 3가지 촬영 꿀팁',
    btnGenerateHooks: '훅 & 캡션 생성하기',
    btnGeneratingHooks: '캡션 생성 중...',
    generatedHooksLabel: '추천 자막 훅',

    // SafeZone
    safeZoneHide: '인스타그램 UI 안전지대 숨기기',
    safeZoneShow: '인스타그램 UI 안전지대 가이드',
    safeZoneTop: '상단 여백 (110px) - 텍스트 가려짐 주의',
    safeZoneCenter: '자막 & 텍스트 훅 최적 배치 구간',
    safeZoneFollow: '팔로우',

    // Analytics Dashboard
    analyticsTitle: '실시간 릴스 성과 분석',
    analyticsSub: '진단된 모든 릴스의 평점 변화, 이탈률 감소 추이, 팔로워 전환 잠재력을 분석합니다',
    totalEvaluated: '총 진단 릴스',
    avgQualityScore: '평균 알고리즘 평점',
    chartTrendTitle: '알고리즘 평점 및 이탈률 추이',
    chartAspectTitle: '최근 진단 릴스 5대 항목 평가',
    compareTitle: '릴스 A/B 버전 비교 분석',
    compareClose: '비교 닫기',
    historyTableTitle: '전체 진단 릴스 이력',
    historyTableSub: '릴스를 클릭하여 상세 리포트를 확인하거나 2개의 릴스를 선택해 A/B 비교해보세요',

    // Growth Playbook
    playbookHeaderTitle: '2026 인스타그램 알고리즘 성장 공식',
    playbookHeaderSub: '스크롤을 멈추고 이탈률을 낮추며 비팔로워를 팔로워로 전환하는 핵심 구조',
    formulaRetention: '시청 지속률 (훅 + 페이싱)',
    formulaShareability: '높은 공유성 (DM 전달)',
    formulaCTA: '명확한 CTA',
    formulaResult: '바이럴 노출 & 비팔로워 도달',
    rule1Title: 'I. 이탈률 낮추는 릴스 구조',
    rule2Title: 'II. 알고리즘 노출 & 기술 규격',

    // Saved Audits History
    historyTitle: '저장된 진단 및 수정 이력',
    historySub: '진단된 릴스를 선택하여 5성급 항목별 평가와 편집 개선안을 확인하세요',
    viewEvaluation: '진단 결과 보기',
    durationLabel: '재생 시간',
    skipRateLabel: '이탈률',

    // Disclaimer
    aiDisclaimerTitle: '안내 및 유의사항',
    aiDisclaimer: '참고: AI 분석 결과와 알고리즘 예측은 편집과 기획을 돕기 위한 참고 지표이며 100% 정확하지 않거나 오차가 발생할 수 있습니다. 채널의 특성과 실제 시청자 반응을 함께 살피며 유연하게 활용해주세요.',
    aiDisclaimerShort: 'AI 진단은 기획 및 편집 참고용이며 오차가 있을 수 있습니다. 실제 시청자 반응과 함께 종합적으로 판단해주세요.',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(getInitialLanguage());

  const t = (key: keyof typeof translations['en']): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
