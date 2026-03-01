'use server';

import { createClient } from '@/lib/supabase/server';
import { updateMasteryFromCounts, scheduleNextReview } from '@/lib/mastery/masteryEngine';

/**
 * Submits one answer: writes an Attempt, upserts Skill Mastery (Bayesian update),
 * schedules spaced repetition, returns updated mastery level.
 * RLS ensures only the learner (or parent) can write.
 */
export async function submitAnswer(exerciseId: string, correct: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw new Error(authError.message);
  if (!user) throw new Error('Not authenticated');

  const learnerId = user.id;

  // Resolve skill_id from exercise (exercise -> lesson -> skill)
  const { data: exercise, error: exError } = await supabase
    .from('exercises')
    .select('id, lesson_id')
    .eq('id', exerciseId)
    .single();

  if (exError || !exercise) throw new Error('Exercise not found');

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('skill_id')
    .eq('id', exercise.lesson_id)
    .single();

  if (lessonError || !lesson) throw new Error('Lesson not found');

  const skillId = lesson.skill_id;

  // Insert attempt
  const { error: attemptError } = await supabase.from('attempts').insert({
    learner_id: learnerId,
    exercise_id: exerciseId,
    correct,
  });

  if (attemptError) throw new Error(attemptError.message);

  const now = new Date();

  const skillExerciseIds = await getExerciseIdsForSkill(supabase, skillId);

  // Count attempts for this learner+skill (include the one we just inserted)
  const { data: attemptRows } = await supabase
    .from('attempts')
    .select('exercise_id, correct')
    .eq('learner_id', learnerId);

  const skillAttempts = (attemptRows ?? []).filter((a) => skillExerciseIds.has(a.exercise_id));
  const totalAttempts = skillAttempts.length;
  const totalCorrect = skillAttempts.filter((a) => a.correct).length;

  const updated = updateMasteryFromCounts(
    totalAttempts - 1,
    totalCorrect - (correct ? 1 : 0),
    correct
  );
  const nextReviewAt = scheduleNextReview(correct, updated.mastery_probability, now);

  // Keep level for backward compat (e.g. parent view): derive from mastery_probability
  const level = Math.min(5, Math.max(0, Math.round(updated.mastery_probability * 5)));

  const { error: masteryError } = await supabase.from('skill_mastery').upsert(
    {
      learner_id: learnerId,
      skill_id: skillId,
      level,
      mastery_probability: updated.mastery_probability,
      confidence_score: updated.confidence_score,
      attempts_count: totalAttempts,
      last_attempt_at: now.toISOString(),
      next_review_at: nextReviewAt.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: 'learner_id,skill_id' }
  );

  if (masteryError) throw new Error(masteryError.message);

  // Upsert spaced repetition schedule (single source of truth for "when to review")
  const { error: reviewError } = await supabase.from('review_schedule').upsert(
    {
      learner_id: learnerId,
      skill_id: skillId,
      next_review_at: nextReviewAt.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: 'learner_id,skill_id' }
  );

  if (reviewError) throw new Error(reviewError.message);

  return { masteryLevel: level };
}

async function getExerciseIdsForSkill(
  supabase: Awaited<ReturnType<typeof createClient>>,
  skillId: string
): Promise<Set<string>> {
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id')
    .eq('skill_id', skillId);
  if (!lessons?.length) return new Set();
  const lessonIds = lessons.map((l) => l.id);
  const { data: exs } = await supabase
    .from('exercises')
    .select('id')
    .in('lesson_id', lessonIds);
  return new Set((exs ?? []).map((e) => e.id));
}
