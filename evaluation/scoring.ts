import { ASPECTS, RUBRIC_VERSION, type Aspect, type Level, type Observations, type ScoreResult, type Trait } from './contracts';
import { EvaluationError } from './validation';

// Historical/reference definitions: server.ts reference-old rubric 303 and weighted fallback 700.
export const WEIGHTS: Readonly<Record<Aspect, number>> = Object.freeze({ hookStrength: .30, pacingAndStimulation: .25, narrativeAndPayoff: .20, loopingAndRetention: .15, technicalCompliance: .10 });
export const LEVEL_SCORE: Readonly<Partial<Record<Level, number>>> = Object.freeze({ ineffective: .5, weak: 1.5, below_average: 2.5, competent: 3.2, strong: 4, excellent: 4.5, exceptional: 4.8, outstanding: 5 });
const criteria: Record<Aspect, Trait[]> = {
  hookStrength: ['firstFrame', 'openingClarity', 'curiosity', 'anticipation'],
  pacingAndStimulation: ['progression', 'pacing', 'visualInterest'],
  narrativeAndPayoff: ['payoff', 'setup'],
  loopingAndRetention: ['ending', 'replay'],
  technicalCompliance: ['imageQuality', 'textLegibility'],
};
const round = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;
const clamp = (n: number, lo = 0, hi = 5) => Math.min(hi, Math.max(lo, n));
export function calculateOverall(scores: Record<Aspect, number>): number {
  return round(ASPECTS.reduce((sum, a) => sum + scores[a] * WEIGHTS[a], 0));
}

export function scoreObservations(o: Observations): ScoreResult {
  const value = (key: Trait): number => {
    const judgment = o.traits[key];
    const score = LEVEL_SCORE[judgment.level];
    if (score === undefined || judgment.confidence === 'low') throw new EvaluationError('INSUFFICIENT_EVIDENCE', 'A required part of the Reel could not be assessed confidently. No final rating was generated.');
    return score;
  };
  const appliedRules: ScoreResult['appliedRules'] = [];
  const aspectScores = {} as Record<Aspect, number>;
  for (const a of ASPECTS) {
    const keys = criteria[a].filter(key => !(key === 'textLegibility' && o.traits[key].level === 'not_applicable'));
    let score = keys.reduce((sum, key) => sum + value(key), 0) / keys.length;
    const weaknesses = o.weaknesses.filter(w => w.aspect === a);
    // Qualitative anchors already describe quality. Explicit failures impose ceilings, not
    // a second deduction for the same defect. Distinct minor problems have a bounded total effect.
    const severe = weaknesses.some(w => w.severity === 'severe');
    const major = weaknesses.some(w => w.severity === 'major');
    if (severe) { score = Math.min(score, 1.5); appliedRules.push({ aspect: a, rule: 'severe_failure_cap_1.5' }); }
    else if (major) { score = Math.min(score, 2.5); appliedRules.push({ aspect: a, rule: 'major_failure_cap_2.5' }); }
    else if (weaknesses.length) { score -= Math.min(.4, weaknesses.length * .2); appliedRules.push({ aspect: a, rule: 'minor_weaknesses_max_0.4' }); }
    if (score > 4.5 && keys.some(key => !['exceptional', 'outstanding'].includes(o.traits[key].level) || o.traits[key].confidence !== 'high')) {
      score = 4.5; appliedRules.push({ aspect: a, rule: 'exceptional_evidence_gate' });
    }
    aspectScores[a] = round(clamp(score));
  }
  const overallStars = calculateOverall(aspectScores);
  const hookRisk = 1 - aspectScores.hookStrength / 5;
  const flowRisk = 1 - aspectScores.pacingAndStimulation / 5;
  const payoffRisk = 1 - aspectScores.narrativeAndPayoff / 5;
  // Directional heuristic, NOT a measured Instagram probability. Rounded to 5-point bands.
  const risk = .60 * hookRisk + .25 * flowRisk + .15 * payoffRisk;
  let midpoint = Math.round((10 + risk * 80) / 5) * 5;
  if (o.weaknesses.some(w => w.aspect === 'hookStrength' && w.severity === 'severe')) midpoint = Math.max(65, midpoint);
  const width = o.confidence === 'high' ? 15 : 20;
  const index = (n: number) => Math.round(clamp(n, 0, 100) / 5) * 5;
  // Missing forecast evidence does not invalidate well-supported creative aspect ratings.
  const optionalEstimate = (keys: Trait[], calculate: () => number) => keys.some(key => LEVEL_SCORE[o.traits[key].level] === undefined || o.traits[key].confidence === 'low') ? null : calculate();
  const nonFollower = optionalEstimate(['nonFollowerAppeal'], () => round((value('nonFollowerAppeal') * .45 + value('curiosity') * .2 + aspectScores.hookStrength * .2 + value('visualInterest') * .15)));
  const conversion = optionalEstimate(['conversion'], () => index((value('conversion') * .5 + value('payoff') * .2 + aspectScores.hookStrength * .3) * 20));
  const sharing = optionalEstimate(['shareability'], () => index((value('shareability') * .6 + value('payoff') * .2 + value('replay') * .2) * 20));
  return {
    version: RUBRIC_VERSION, aspectScores, overallStars, overallScorePercent: Math.round(overallStars * 20),
    verdict: overallStars >= 4.4 ? 'Viral Contender' : overallStars >= 3.8 ? 'Strong Growth' : overallStars >= 3 ? 'Moderate Retention' : 'High Skip Risk',
    skipEstimate: { low: Math.max(0, midpoint - width), high: Math.min(100, midpoint + width), midpoint, band: midpoint >= 65 ? 'very_high' : midpoint >= 45 ? 'high' : midpoint >= 25 ? 'moderate' : 'low', basis: 'heuristic_not_empirically_calibrated' },
    nonFollowerInterestStars: nonFollower, conversionIndex: conversion, shareabilityIndex: sharing, appliedRules,
  };
}
