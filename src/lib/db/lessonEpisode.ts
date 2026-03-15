/**
 * Phase 3: Persist and load lesson episodes (Ace Instruction Engine).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LessonPlan } from '@/lib/instruction/lesson-plan-schema';

export type LessonEpisodeRow = {
  id: string;
  learner_id: string;
  domain: string;
  skill: string;
  skill_id: string | null;
  lesson_plan_json: unknown;
  scene_sequence: unknown;
  generated_by: string;
  version: string;
  support_level: string | null;
  promotion_decision: string | null;
  completion_status: string;
  current_scene_index: number;
  workmat_output?: { workmat_used: boolean; state?: unknown; validation_result?: unknown } | null;
  created_at: string;
  updated_at: string;
};

export async function createLessonEpisode(
  supabase: SupabaseClient,
  payload: {
    learner_id: string;
    domain: string;
    skill: string;
    skill_id?: string | null;
    lesson_plan: LessonPlan;
    generated_by: 'openai' | 'deterministic';
  }
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('lesson_episodes')
    .insert({
      learner_id: payload.learner_id,
      domain: payload.domain,
      skill: payload.skill,
      skill_id: payload.skill_id ?? null,
      lesson_plan_json: payload.lesson_plan as unknown as Record<string, unknown>,
      scene_sequence: payload.lesson_plan.scene_sequence as unknown as unknown[],
      generated_by: payload.generated_by,
      version: payload.lesson_plan.version ?? '1.0',
      support_level: payload.lesson_plan.support_level ?? null,
      promotion_decision: payload.lesson_plan.promotion_decision ?? null,
      completion_status: 'in_progress',
      current_scene_index: 0,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[lessonEpisode] create error', error);
    return null;
  }
  return data ? { id: data.id } : null;
}

export async function getLessonEpisode(
  supabase: SupabaseClient,
  episodeId: string,
  learnerId: string
): Promise<LessonEpisodeRow | null> {
  const { data, error } = await supabase
    .from('lesson_episodes')
    .select('*')
    .eq('id', episodeId)
    .eq('learner_id', learnerId)
    .maybeSingle();

  if (error || !data) return null;
  return data as LessonEpisodeRow;
}

export async function updateLessonEpisodeProgress(
  supabase: SupabaseClient,
  episodeId: string,
  learnerId: string,
  payload: { current_scene_index: number; completion_status?: 'in_progress' | 'completed' }
): Promise<boolean> {
  const { error } = await supabase
    .from('lesson_episodes')
    .update({
      current_scene_index: payload.current_scene_index,
      ...(payload.completion_status && { completion_status: payload.completion_status }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', episodeId)
    .eq('learner_id', learnerId);

  return !error;
}
