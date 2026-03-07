'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Insert a misconception record for a wrong attempt.
 * RLS ensures learner (or parent) only.
 */
export async function insertAttemptMisconception(params: {
  attemptId: string;
  learnerId: string;
  skillId: string;
  tag: string;
  exerciseId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from('attempt_misconceptions').insert({
    attempt_id: params.attemptId,
    learner_id: params.learnerId,
    skill_id: params.skillId,
    tag: params.tag,
    exercise_id: params.exerciseId ?? null,
    metadata: params.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

/**
 * Count how many times a specific misconception tag appeared for learner+skill
 * in the last N attempts (recent window). Used for struggle rule (>= 3 same tag).
 */
export async function countRecentMisconceptionTag(params: {
  learnerId: string;
  skillId: string;
  tag: string;
  limit?: number;
}): Promise<number> {
  const supabase = await createClient();
  const limit = params.limit ?? 20;

  const { data, error } = await supabase
    .from('attempt_misconceptions')
    .select('id')
    .eq('learner_id', params.learnerId)
    .eq('skill_id', params.skillId)
    .eq('tag', params.tag)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/**
 * Get recent misconception tags for a learner+skill (for struggle detection).
 * Returns list of { tag, count } in the recent window.
 */
export async function getRecentMisconceptionCounts(params: {
  learnerId: string;
  skillId: string;
  windowSize?: number;
}): Promise<{ tag: string; count: number }[]> {
  const supabase = await createClient();
  const windowSize = params.windowSize ?? 30;

  const { data, error } = await supabase
    .from('attempt_misconceptions')
    .select('tag')
    .eq('learner_id', params.learnerId)
    .eq('skill_id', params.skillId)
    .order('created_at', { ascending: false })
    .limit(windowSize);

  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
  }
  return [...counts.entries()].map(([tag, count]) => ({ tag, count }));
}
