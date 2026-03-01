'use server';

import { createClient } from '@/lib/supabase/server';
import {
  selectNextExercise,
  selectNextExerciseWithMastery,
  type MasteryForSkill,
} from '@/lib/curriculum/nextExerciseLogic';

export type NextExerciseResult = {
  id: string;
  prompt: string;
} | null;

type ExerciseRow = {
  id: string;
  lesson_id: string;
  prompt: string;
  sort_order: number;
  skill_id: string;
};

/**
 * Fetches the next exercise for the current learner in the given domain.
 * Prioritizes: (1) due spaced-review skills, (2) edge-of-learning skills, (3) curriculum order.
 * Never returns the same exercise as lastExerciseId.
 */
export async function getNextExercise(
  domainSlug: string,
  lastExerciseId?: string | null
): Promise<NextExerciseResult> {
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

  const exercises: ExerciseRow[] = [];
  const domainSkillIds: string[] = [];

  const { data: units } = await supabase
    .from('units')
    .select('id')
    .eq('domain_id', domain.id)
    .order('sort_order', { ascending: true });

  if (units?.length) {
    for (const unit of units) {
      const { data: skills } = await supabase
        .from('skills')
        .select('id')
        .eq('unit_id', unit.id)
        .order('sort_order', { ascending: true });

      if (!skills?.length) continue;

      for (const skill of skills) {
        domainSkillIds.push(skill.id);
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

          if (exs?.length)
            exercises.push(...exs.map((e) => ({ ...e, skill_id: skill.id })));
        }
      }
    }
  } else {
    const { data: skills } = await supabase
      .from('skills')
      .select('id')
      .eq('domain_id', domain.id)
      .order('sort_order', { ascending: true });

    if (skills?.length) {
      for (const skill of skills) {
        domainSkillIds.push(skill.id);
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

          if (exs?.length)
            exercises.push(...exs.map((e) => ({ ...e, skill_id: skill.id })));
        }
      }
    }
  }

  if (exercises.length === 0) return null;

  const [{ data: attempts }, { data: masteryRows }, { data: reviewRows }] = await Promise.all([
    supabase
      .from('attempts')
      .select('exercise_id')
      .eq('learner_id', learnerId)
      .eq('correct', true),
    domainSkillIds.length > 0
      ? supabase
          .from('skill_mastery')
          .select('skill_id, mastery_probability, confidence_score, next_review_at')
          .eq('learner_id', learnerId)
          .in('skill_id', domainSkillIds)
      : { data: [] as { skill_id: string; mastery_probability: number; confidence_score: number; next_review_at: string | null }[] },
    domainSkillIds.length > 0
      ? supabase
          .from('review_schedule')
          .select('skill_id, next_review_at')
          .eq('learner_id', learnerId)
          .in('skill_id', domainSkillIds)
      : { data: [] as { skill_id: string; next_review_at: string }[] },
  ]);

  const now = new Date().toISOString();
  const masteryBySkill = new Map<string, MasteryForSkill>();
  for (const m of masteryRows ?? []) {
    masteryBySkill.set(m.skill_id, {
      mastery_probability: m.mastery_probability ?? 0.3,
      confidence_score: m.confidence_score ?? 0,
      next_review_at: m.next_review_at ?? null,
    });
  }
  for (const r of reviewRows ?? []) {
    if (!masteryBySkill.has(r.skill_id))
      masteryBySkill.set(r.skill_id, {
        mastery_probability: 0.3,
        confidence_score: 0,
        next_review_at: r.next_review_at,
      });
    else {
      const existing = masteryBySkill.get(r.skill_id)!;
      masteryBySkill.set(r.skill_id, { ...existing, next_review_at: r.next_review_at });
    }
  }
  const dueReviewSkillIds = new Set<string>(
    (reviewRows ?? [])
      .filter((r) => r.next_review_at && r.next_review_at <= now)
      .map((r) => r.skill_id)
  );
  for (const [skillId, m] of masteryBySkill) {
    if (m.next_review_at && m.next_review_at <= now) dueReviewSkillIds.add(skillId);
  }

  const next = selectNextExerciseWithMastery(
    exercises,
    (attempts ?? []).map((a) => ({ exercise_id: a.exercise_id })),
    masteryBySkill,
    dueReviewSkillIds,
    lastExerciseId ?? null
  );

  if (!next) return null;

  return { id: next.id, prompt: next.prompt };
}
