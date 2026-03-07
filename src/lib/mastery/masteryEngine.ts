/**
 * Noraliva Mastery Engine: Bayesian update and spaced repetition scheduling.
 * Pure functions for unit testing; used by submitAnswer and getNextExercise.
 */

const PRIOR_ALPHA = 0.3 * 2; // pseudo-successes for prior mean 0.3
const PRIOR_BETA = 0.7 * 2;  // pseudo-failures

export type MasteryState = {
  mastery_probability: number;
  confidence_score: number;
  attempts_count: number;
  last_attempt_at: Date | null;
  next_review_at: Date | null;
};

/**
 * Compute posterior mastery from (attempts_count, correct_count) and one new attempt.
 * Beta-Binomial: prior Beta(α,β), after s successes and f failures posterior mean = (α+s)/(α+β+n).
 */
export function updateMasteryFromCounts(
  attemptsCount: number,
  correctCount: number,
  correct: boolean
): { mastery_probability: number; confidence_score: number; attempts_count: number } {
  const s = correctCount + (correct ? 1 : 0);
  const n = attemptsCount + 1;
  const total = PRIOR_ALPHA + PRIOR_BETA + n;
  const alpha = PRIOR_ALPHA + s;
  return {
    mastery_probability: alpha / total,
    confidence_score: total,
    attempts_count: n,
  };
}

/**
 * Schedule next review time using spaced repetition (Phase 2):
 * - Correct: short-term 7–14 days (mastery building) or long-term 30–90 days (mastery high).
 * - Incorrect: next review in 10 minutes.
 */
export function scheduleNextReview(
  correct: boolean,
  masteryProbability: number,
  now: Date = new Date()
): Date {
  if (correct) {
    const next = new Date(now);
    if (masteryProbability >= 0.85) {
      // Long-term: 30–90 days
      const days = 30 + (masteryProbability - 0.85) * (60 / 0.15);
      next.setDate(next.getDate() + Math.round(Math.min(90, Math.max(30, days))));
    } else {
      // Short-term: 7–14 days
      const days = 7 + (masteryProbability - 0.5) * (7 / 0.35);
      next.setDate(next.getDate() + Math.round(Math.min(14, Math.max(7, days))));
    }
    return next;
  }
  const next = new Date(now);
  next.setMinutes(next.getMinutes() + 10);
  return next;
}

/**
 * "Edge of learning": skills with mastery in (0.3, 0.85) are optimal for practice.
 * Returns a score in [0, 1]; higher = more on the edge (better to practice).
 */
export function edgeOfLearningScore(masteryProbability: number, confidenceScore: number): number {
  if (confidenceScore <= 0) return 0.5; // unknown skill
  const distFromMid = 1 - Math.abs(masteryProbability - 0.55) / 0.55; // peak at 0.55
  const lowConfBonus = Math.max(0, 1 - confidenceScore / 20); // prefer lower confidence when similar
  return 0.7 * Math.max(0, distFromMid) + 0.3 * lowConfBonus;
}

/** Minimum confidence for promotion (attempts enough to be sure). */
export const PROMOTION_CONFIDENCE_MIN = 5;

/** Promotion rule: mastery >= 0.85 AND confidence >= threshold AND at least 2 spaced checks passed. */
export function isPromoted(params: {
  mastery_probability: number;
  confidence_score: number;
  spaced_check_count: number;
}): boolean {
  return (
    params.mastery_probability >= 0.85 &&
    params.confidence_score >= PROMOTION_CONFIDENCE_MIN &&
    params.spaced_check_count >= 2
  );
}

/** Struggle rule: accuracy < 0.60 OR same misconception >= 3 times in recent window. */
export function isStruggling(params: {
  accuracy: number;
  recentMisconceptionCounts: { tag: string; count: number }[];
}): boolean {
  if (params.accuracy < 0.6) return true;
  return params.recentMisconceptionCounts.some((c) => c.count >= 3);
}
