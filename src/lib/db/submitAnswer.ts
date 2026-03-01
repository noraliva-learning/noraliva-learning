'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Submits one answer: writes an Attempt, upserts Skill Mastery, returns updated mastery level.
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

  // Upsert skill_mastery: increment level if correct, else keep current (or 0)
  const { data: existing } = await supabase
    .from('skill_mastery')
    .select('id, level')
    .eq('learner_id', learnerId)
    .eq('skill_id', skillId)
    .maybeSingle();

  const newLevel = correct
    ? (existing?.level ?? 0) + 1
    : (existing?.level ?? 0);

  const { error: masteryError } = await supabase.from('skill_mastery').upsert(
    {
      learner_id: learnerId,
      skill_id: skillId,
      level: newLevel,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'learner_id,skill_id' }
  );

  if (masteryError) throw new Error(masteryError.message);

  return { masteryLevel: newLevel };
}
