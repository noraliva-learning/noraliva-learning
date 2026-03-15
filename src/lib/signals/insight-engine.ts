/**
 * Phase 5: Derive learner insights and confidence/guessing heuristics from signals.
 * Does not overclaim certainty; stores as interpreted signal.
 */

import type { LearningSignals } from './learning-signals-schema';

export type DerivedInsight = {
  insight_type: string;
  summary_plain_english: string;
  evidence_summary: Record<string, unknown>;
};

const FAST_MS = 5000;
const SLOW_MS = 15000;
const RAPID_GUESS_MS = 2000;

/**
 * Derive insights from this lesson's signals (and optionally recent history).
 * Called after each lesson completion.
 */
export function deriveLearnerInsights(
  signals: LearningSignals,
  _recentSignals?: LearningSignals[]
): DerivedInsight[] {
  const insights: DerivedInsight[] = [];
  const {
    response_latency_guided_ms: guidedMs,
    response_latency_independent_ms: indepMs,
    hint_requests_total: hints,
    answer_changed_before_submit_guided: answerChangedGuided,
    answer_changed_before_submit_independent: answerChangedIndep,
    guided_success: guidedOk,
    independent_success: indepOk,
    workmat_used: workmatUsed,
    workmat_validation_valid: workmatValid,
    review_success: reviewOk,
    narration_replay_count: replayCount,
  } = signals;

  // Confidence / guessing heuristics (interpreted signal, not truth)
  if (guidedOk && guidedMs != null && guidedMs < FAST_MS) {
    insights.push({
      insight_type: 'fast_confident_correct',
      summary_plain_english: 'Often answers quickly and correctly when supported (guided).',
      evidence_summary: { response_latency_guided_ms: guidedMs, guided_success: true },
    });
  }
  if ((guidedOk || indepOk) && ((guidedMs != null && guidedMs > SLOW_MS) || (indepMs != null && indepMs > SLOW_MS))) {
    insights.push({
      insight_type: 'slow_thoughtful_correct',
      summary_plain_english: 'Takes time to think and then gets it right.',
      evidence_summary: {
        response_latency_guided_ms: guidedMs,
        response_latency_independent_ms: indepMs,
        guided_success: guidedOk,
        independent_success: indepOk,
      },
    });
  }
  if (!indepOk && indepMs != null && indepMs < RAPID_GUESS_MS) {
    insights.push({
      insight_type: 'rapid_guess_pattern',
      summary_plain_english: 'Sometimes answers very quickly on independent try without success (possible guessing).',
      evidence_summary: { response_latency_independent_ms: indepMs, independent_success: false },
    });
  }
  if (answerChangedGuided || answerChangedIndep) {
    insights.push({
      insight_type: 'answer_switching',
      summary_plain_english: 'Often changes answer before submitting—still building confidence.',
      evidence_summary: {
        answer_changed_before_submit_guided: answerChangedGuided,
        answer_changed_before_submit_independent: answerChangedIndep,
      },
    });
  }
  if (hints != null && hints > 0 && (guidedOk || indepOk)) {
    insights.push({
      insight_type: 'hint_dependent_success',
      summary_plain_english: 'Succeeds with hints; may benefit from a bit more support on new concepts.',
      evidence_summary: { hint_requests_total: hints, guided_success: guidedOk, independent_success: indepOk },
    });
  }

  // Guided vs independent gap
  if (guidedOk && !indepOk) {
    insights.push({
      insight_type: 'guided_not_independent_gap',
      summary_plain_english: 'Does well with support but still building independence—practice will help.',
      evidence_summary: { guided_success: true, independent_success: false },
    });
  }

  // Visual / workmat success
  if (workmatUsed && workmatValid) {
    insights.push({
      insight_type: 'workmat_visual_success',
      summary_plain_english: 'Learns well with visual modeling and drawing (Work Mat).',
      evidence_summary: { workmat_used: true, workmat_validation_valid: true },
    });
  }

  // Retention after delay
  if (reviewOk) {
    insights.push({
      insight_type: 'retains_after_delay',
      summary_plain_english: 'Retains concepts well after a delay (review success).',
      evidence_summary: { review_success: true },
    });
  }

  // Narration preference
  if (replayCount != null && replayCount > 0) {
    insights.push({
      insight_type: 'prefers_narration_replay',
      summary_plain_english: 'Often replays narration—listening supports learning.',
      evidence_summary: { narration_replay_count: replayCount },
    });
  }

  return insights;
}
