'use server';

import { createClient } from '@/lib/supabase/server';
import { selectNextExercise } from '@/lib/curriculum/nextExerciseLogic';

export type NextExerciseResult = {
  id: string;
  prompt: string;
} | null;

/**
 * Fetches the next exercise for the current learner in the given domain.
 * Uses deterministic offline progression: unit -> skill -> lesson -> exercise order;
 * picks the first exercise without a correct attempt, or the first for review.
 */
export async function getNextExercise(domainSlug: string): Promise<NextExerciseResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw new Error(authError.message);
  if (!user) throw new Error('Not authenticated');

  const learnerId = user.id;

  const { data: domain } = await supabase
    .from('domains')
    .select('id')
    .eq('slug', domainSlug)
    .maybeSingle();

  if (!domain) return null;

  const { data: units } = await supabase
    .from('units')
    .select('id')
    .eq('domain_id', domain.id)
    .order('sort_order', { ascending: true });

  const exercises: { id: string; lesson_id: string; prompt: string; sort_order: number }[] = [];

  if (units?.length) {
    for (const unit of units) {
      const { data: skills } = await supabase
        .from('skills')
        .select('id')
        .eq('unit_id', unit.id)
        .order('sort_order', { ascending: true });

      if (!skills?.length) continue;

      for (const skill of skills) {
        const { data: lessons } = await supabase
          .from('lessons')
          .select('id')
          .eq('skill_id', skill.id)
          .order('sort_order', { ascending: true });

        if (!lessons?.length) continue;

        for (const lesson of lessons) {
          const { data: exs } = await supabase
            .from('exercises')
            .select('id, lesson_id, prompt, sort_order')
            .eq('lesson_id', lesson.id)
            .order('sort_order', { ascending: true });

          if (exs?.length) exercises.push(...exs);
        }
      }
    }
  } else {
    // Fallback: no units yet (e.g. only 00001-00004), use domain -> skills -> lessons -> exercises
    const { data: skills } = await supabase
      .from('skills')
      .select('id')
      .eq('domain_id', domain.id)
      .order('sort_order', { ascending: true });

    if (skills?.length) {
      for (const skill of skills) {
        const { data: lessons } = await supabase
          .from('lessons')
          .select('id')
          .eq('skill_id', skill.id)
          .order('sort_order', { ascending: true });

        if (!lessons?.length) continue;

        for (const lesson of lessons) {
          const { data: exs } = await supabase
            .from('exercises')
            .select('id, lesson_id, prompt, sort_order')
            .eq('lesson_id', lesson.id)
            .order('sort_order', { ascending: true });

          if (exs?.length) exercises.push(...exs);
        }
      }
    }
  }

  if (exercises.length === 0) return null;

  const { data: attempts } = await supabase
    .from('attempts')
    .select('exercise_id')
    .eq('learner_id', learnerId)
    .eq('correct', true);

  const next = selectNextExercise(
    exercises,
    (attempts ?? []).map((a) => ({ exercise_id: a.exercise_id }))
  );

  if (!next) return null;

  return { id: next.id, prompt: next.prompt };
}
