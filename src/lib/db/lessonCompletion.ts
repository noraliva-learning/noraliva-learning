/**
 * Phase 3B: Persist lesson completion — mastery, review_schedule, learner_lesson_history.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LessonOutcomeSummary } from '@/lib/instruction/completion-schemas';

export async function upsertSkillMastery(
  supabase: SupabaseClient,
  learnerId: string,
  skillId: string,
  payload: {
    mastery_probability: number;
    confidence_score: number;
    attempts_count: number;
    next_review_at: string | null;
    last_attempt_at: string;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('skill_mastery')
    .upsert(
      {
        learner_id: learnerId,
        skill_id: skillId,
        level: Math.round(payload.mastery_probability * 5),
        mastery_probability: payload.mastery_probability,
        confidence_score: payload.confidence_score,
        attempts_count: payload.attempts_count,
        last_attempt_at: payload.last_attempt_at,
        next_review_at: payload.next_review_at,
        updated_at: payload.last_attempt_at,
      },
      { onConflict: 'learner_id,skill_id' }
    );

  return !error;
}

export async function upsertReviewSchedule(
  supabase: SupabaseClient,
  learnerId: string,
  skillId: string,
  nextReviewAt: string
): Promise<boolean> {
  const { error } = await supabase
    .from('review_schedule')
    .upsert(
      {
        learner_id: learnerId,
        skill_id: skillId,
        next_review_at: nextReviewAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'learner_id,skill_id' }
    );

  return !error;
}

export async function insertLearnerLessonHistory(
  supabase: SupabaseClient,
  payload: {
    learner_id: string;
    episode_id: string;
    domain: string;
    skill_id: string;
    skill_name: string;
    promotion_decision: string;
    mastery_before: number | null;
    mastery_after: number | null;
    confidence_before: number | null;
    confidence_after: number | null;
    next_skill_id: string | null;
    next_skill_reason: string | null;
    next_skill_why: string | null;
  }
): Promise<boolean> {
  const { error } = await supabase.from('learner_lesson_history').insert(payload);
  return !error;
}

export async function updateLessonEpisodeOnComplete(
  supabase: SupabaseClient,
  episodeId: string,
  learnerId: string,
  outcome: LessonOutcomeSummary,
  workmatOutput?: { workmat_used: boolean; state?: unknown; validation_result?: unknown } | null
): Promise<boolean> {
  const updatePayload: Record<string, unknown> = {
    completion_status: 'completed',
    promotion_decision: outcome.promotion_decision,
    updated_at: new Date().toISOString(),
  };
  if (workmatOutput != null) {
    updatePayload.workmat_output = workmatOutput;
  }
  const { error } = await supabase
    .from('lesson_episodes')
    .update(updatePayload)
    .eq('id', episodeId)
    .eq('learner_id', learnerId);

  return !error;
}
