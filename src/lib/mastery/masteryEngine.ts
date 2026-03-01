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
 * Schedule next review time using simple spaced repetition:
 * - Correct: push next review by 1–7 days (higher mastery = longer interval)
 * - Incorrect: next review in 10 minutes
 */
export function scheduleNextReview(
  correct: boolean,
  masteryProbability: number,
  now: Date = new Date()
): Date {
  if (correct) {
    const days = masteryProbability >= 0.9 ? 7 : masteryProbability >= 0.7 ? 3 : 1;
    const next = new Date(now);
    next.setDate(next.getDate() + days);
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
