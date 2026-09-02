export interface ReelEvaluation {
  id: string;
  title: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  fileFormat: string;
  fileSizeMb: number;
  niche: string;
  captionInput?: string;
  videoConcept?: string;
  audioType: string;
  timestamp: string;

  // Overall Ratings
  overallStars: number; // 0.0 to 5.0
  overallScorePercent: number; // 0 to 100
  overallVerdict: 'Viral Contender' | 'Strong Growth' | 'Moderate Retention' | 'High Skip Risk';

  // Core Key Metrics
  expectedSkipRatePercent: number; // lower is better
  followerGrowthPotentialPercent: number;
  nonFollowerInterestStars: number;
  shareabilitySendScore: number; // 0 to 100

  // 5-Star Critical Aspect Ratings
  aspects: {
    hookStrength: {
      stars: number;
      label: string;
      visualHook: string;
      textHook: string;
      audioHook: string;
      verdict: string;
    };
    pacingAndStimulation: {
      stars: number;
      label: string;
      avgCutFrequencySec: number;
      deadAirDetectedSec: number;
      patternInterruptsCount: number;
      verdict: string;
    };
    narrativeAndPayoff: {
      stars: number;
      label: string;
      setupDurationSec: number;
      payoffTimingSec: number;
      verdict: string;
    };
    loopingAndRetention: {
      stars: number;
      label: string;
      seamlessLoopScore: number; // 0 to 100
      rewatchTriggerPresent: boolean;
      verdict: string;
    };
    technicalCompliance: {
      stars: number;
      label: string;
      watermarkDetected: boolean;
      resolutionText: string;
      safeZoneViolation: boolean;
      captionQuality: string;
      verdict: string;
    };
  };

  // Actionable Suggestions
  actionableEdits: Array<{
    id: string;
    timestampRange: string;
    type: 'cut' | 'hook' | 'pacing' | 'audio' | 'safezone' | 'payoff';
    severity: 'critical' | 'recommended' | 'optional';
    issue: string;
    solution: string;
  }>;

  // Caption & Growth Package
  captionOptimization: {
    recommendedHooks: string[];
    valueCTA: string;
    cliffhangerCTA: string;
    commentBaitQuestion: string;
    targetHashtags: string[];
  };

  // Version Comparison
  versionTag?: string; // e.g. "v1", "v2 (Edited)"
  parentReelId?: string;

  // Static Caching & Objective Audit Metadata
  isCachedEvaluation?: boolean;
  criticalDefectsIdentified?: string[];

  // Stance-by-Stance Text Hook & On-Screen Guidance (for videos without captions)
  stanceByStanceGuidance?: Array<{
    durationRange: string; // e.g. "0-3s (Zero-Second Hook)"
    stanceTheme: string; // e.g. "Visual Curiosity Gap"
    optionAHookText: string; // Direct benefit hook
    optionBHookText: string; // Question / Curiosity hook
    optionCHookText: string; // Controversial / Story hook
    onScreenGuidance: string; // Timing, font size, safe zone position, animations
  }>;
}

export interface PresetReel {
  id: string;
  title: string;
  niche: string;
  duration: number;
  format: string;
  thumbnail: string;
  videoUrl: string;
  description: string;
  preComputedEvaluation: ReelEvaluation;
}

export interface AnalyticsTrend {
  date: string;
  reelTitle: string;
  overallStars: number;
  skipRate: number;
  growthPotential: number;
  hookStars: number;
  pacingStars: number;
}
