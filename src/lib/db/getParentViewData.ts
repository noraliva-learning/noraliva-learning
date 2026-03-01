'use server';

import { createClient } from '@/lib/supabase/server';

export type AttemptRow = {
  id: string;
  correct: boolean;
  created_at: string;
  prompt: string;
};

export type MasteryRow = {
  skill_name: string;
  level: number;
  updated_at: string;
};

export type ChildProgress = {
  id: string;
  display_name: string;
  role: string;
  attempts: AttemptRow[];
  mastery: MasteryRow[];
};

/**
 * Returns children (profiles where parent_id = current user) with their attempts and skill mastery.
 * RLS ensures only parent can read children's data.
 */
export async function getParentViewData(): Promise<ChildProgress[]> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error('Not authenticated');

  const { data: children } = await supabase
    .from('profiles')
    .select('id, display_name, role')
    .eq('parent_id', user.id);

  if (!children?.length) return [];

  const result: ChildProgress[] = [];

  for (const child of children) {
    const { data: attemptRows } = await supabase
      .from('attempts')
      .select('id, correct, created_at, exercise_id')
      .eq('learner_id', child.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const attempts: AttemptRow[] = [];
    if (attemptRows?.length) {
      for (const a of attemptRows) {
        const { data: ex } = await supabase
          .from('exercises')
          .select('prompt')
          .eq('id', a.exercise_id)
          .single();
        attempts.push({
          id: a.id,
          correct: a.correct,
          created_at: a.created_at,
          prompt: ex?.prompt ?? '—',
        });
      }
    }

    const { data: masteryRows } = await supabase
      .from('skill_mastery')
      .select('skill_id, level, updated_at')
      .eq('learner_id', child.id);

    const mastery: MasteryRow[] = [];
    if (masteryRows?.length) {
      for (const m of masteryRows) {
        const { data: skill } = await supabase
          .from('skills')
          .select('name')
          .eq('id', m.skill_id)
          .single();
        mastery.push({
          skill_name: skill?.name ?? '—',
          level: m.level,
          updated_at: m.updated_at,
        });
      }
    }

    result.push({
      id: child.id,
      display_name: child.display_name || child.role,
      role: child.role,
      attempts,
      mastery,
    });
  }

  return result;
}
