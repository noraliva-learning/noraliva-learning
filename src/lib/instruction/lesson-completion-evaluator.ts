/**
 * Phase 3B: Server-side lesson completion evaluator.
 * Inputs: lesson plan, learner responses, scene outcomes, current mastery.
 * Outputs: outcome summary, promotion decision, deltas, review recommendation, next_skill_candidate.
 */

import type { LessonPlan } from './lesson-plan-schema';
import type { LessonCompletionInput, LessonOutcomeSummary, MasterySnapshot } from './completion-schemas';
import { lessonOutcomeSummarySchema } from './completion-schemas';
import { computePromotionDecision, DEFAULT_PROMOTION_CONFIG } from './promotion-rules';
import { updateMasteryFromCounts, scheduleNextReview } from '@/lib/mastery/masteryEngine';

export type EvaluatorInput = {
  completion: LessonCompletionInput;
  lessonPlan: LessonPlan;
  masteryBefore: MasterySnapshot | null;
  /** Resolved skill_id for the lesson (from episode) */
  skillId: string;
  skillName: string;
  /** For next_skill_candidate: available skill IDs in domain (ordered) */
  domainSkillIds: string[];
  /** For next_skill_candidate: which skill is "next" in curriculum after skillId */
  nextSkillIdInCurriculum: string | null;
  /** Due review skill IDs (for "scheduled_review" reason) */
  dueReviewSkillIds: string[];
};

/**
 * Compute mastery delta from one lesson: treat guided + independent as two "attempts".
 * Correct on both -> positive delta; one or both wrong -> smaller or negative.
 */
function computeMasteryDelta(
  masteryBefore: MasterySnapshot | null,
  guidedSuccess: boolean,
  independentSuccess: boolean
): { mastery_delta: number; confidence_delta: number; newMastery: number; newConfidence: number; newAttempts: number } {
  const attemptsCount = masteryBefore?.attempts_count ?? 0;
  const correctCount = Math.round((masteryBefore?.mastery_probability ?? 0.3) * Math.max(1, attemptsCount));
  const count1 = updateMasteryFromCounts(attemptsCount, correctCount, guidedSuccess);
  const count2 = updateMasteryFromCounts(count1.attempts_count, Math.round(count1.mastery_probability * count1.attempts_count), independentSuccess);
  const oldMastery = masteryBefore?.mastery_probability ?? 0.3;
  const oldConfidence = masteryBefore?.confidence_score ?? 0;
  return {
    mastery_delta: count2.mastery_probability - oldMastery,
    confidence_delta: count2.confidence_score - oldConfidence,
    newMastery: count2.mastery_probability,
    newConfidence: count2.confidence_score,
    newAttempts: count2.attempts_count,
  };
}

/**
 * Evaluate lesson completion and return outcome summary.
 * Does not persist; caller uses this to update mastery, review_schedule, and audit.
 */
export function evaluateLessonCompletion(input: EvaluatorInput): LessonOutcomeSummary {
  const { completion, lessonPlan, masteryBefore, skillId, skillName, domainSkillIds, nextSkillIdInCurriculum, dueReviewSkillIds } = input;
  const guidedSuccess = completion.guided_try_success;
  const independentSuccess = completion.independent_try_success;

  const { mastery_delta, confidence_delta, newMastery, newConfidence, newAttempts } = computeMasteryDelta(
    masteryBefore,
    guidedSuccess,
    independentSuccess
  );

  const decision = computePromotionDecision(
    {
      guidedTrySuccess: guidedSuccess,
      independentTrySuccess: independentSuccess,
      hintUsageCount: completion.hint_usage_count,
      misconceptionSignalsCount: completion.misconception_signals.length,
      masteryBefore: masteryBefore?.mastery_probability ?? 0.3,
      confidenceBefore: masteryBefore?.confidence_score ?? 0,
    },
    DEFAULT_PROMOTION_CONFIG
  );

  const now = new Date();
  const nextReviewDate = scheduleNextReview(independentSuccess, newMastery, now);
  const scheduleReview = decision === 'review' || decision === 'hold' || (decision === 'advance' && newMastery < 0.9);

  let next_skill_candidate: LessonOutcomeSummary['next_skill_candidate'] = undefined;

  if (dueReviewSkillIds.length > 0 && dueReviewSkillIds[0]) {
    const reviewSkillId = dueReviewSkillIds[0];
    next_skill_candidate = {
      skill_id: reviewSkillId,
      skill_name: 'Review skill',
      reason: 'scheduled_review',
      why: 'Scheduled review is due.',
    };
  } else if (decision === 'advance' && nextSkillIdInCurriculum) {
    next_skill_candidate = {
      skill_id: nextSkillIdInCurriculum,
      skill_name: 'Next skill',
      reason: 'advance',
      why: 'Ready for next skill.',
    };
  } else if (decision === 'hold' || decision === 'reteach') {
    next_skill_candidate = {
      skill_id: skillId,
      skill_name: skillName,
      reason: 'reinforce',
      why: decision === 'hold' ? 'Reinforce current skill.' : 'Reteach current skill.',
    };
  } else if (decision === 'review') {
    next_skill_candidate = {
      skill_id: skillId,
      skill_name: skillName,
      reason: 'scheduled_review',
      why: 'Review this skill.',
    };
  }

  const summary: LessonOutcomeSummary = {
    promotion_decision: decision,
    mastery_delta,
    confidence_delta,
    new_mastery_probability: newMastery,
    new_confidence_score: newConfidence,
    new_attempts_count: newAttempts,
    next_review_at: nextReviewDate.toISOString(),
    misconception_updates: completion.misconception_signals.length
      ? completion.misconception_signals.map((tag) => ({ tag, action: 'record' as const }))
      : [],
    review_recommendation: {
      schedule_review: scheduleReview,
      next_review_at: nextReviewDate.toISOString(),
      reason: decision === 'review' ? 'Decay' : decision === 'hold' ? 'Not yet secure' : 'Spaced repetition',
    },
    next_skill_candidate,
  };

  return lessonOutcomeSummarySchema.parse(summary);
}
