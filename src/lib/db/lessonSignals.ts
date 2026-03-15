/**
 * Phase 5: Persist lesson-level learning signals.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LearningSignals } from '@/lib/signals/learning-signals-schema';

export async function insertLessonSignals(
  supabase: SupabaseClient,
  payload: {
    episode_id: string;
    learner_id: string;
    domain: string;
    skill_id: string | null;
    signals_json: LearningSignals;
  }
): Promise<boolean> {
  const { error } = await supabase.from('lesson_signals').insert({
    episode_id: payload.episode_id,
    learner_id: payload.learner_id,
    domain: payload.domain,
    skill_id: payload.skill_id,
    signals_json: payload.signals_json as unknown as Record<string, unknown>,
  });
  if (error) {
    console.error('[lessonSignals] insert error', error);
    return false;
  }
  return true;
}
