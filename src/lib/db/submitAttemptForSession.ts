'use server';

import { createClient } from '@/lib/supabase/server';
import { updateMasteryFromCounts, scheduleNextReview } from '@/lib/mastery/masteryEngine';
import { classifyMisconception } from '@/lib/session/misconceptionClassifier';
import { getMicroLessonForTag } from '@/lib/session/microLessons';
import { insertAttemptMisconception, getRecentMisconceptionCounts } from '@/lib/db/misconceptions';
import type { DomainSlug } from '@/lib/session/misconceptionTags';

export type SubmitAttemptForSessionResult = {
  masteryLevel: number;
  attemptId: string;
  struggleDetected: boolean;
  microLesson?: string;
};

async function getExerciseIdsForSkill(
  supabase: Awaited<ReturnType<typeof createClient>>,
  skillId: string
): Promise<Set<string>> {
  const { data: lessons } = await supabase.from('lessons').select('id').eq('skill_id', skillId);
  if (!lessons?.length) return new Set();
  const lessonIds = lessons.map((l) => l.id);
  const { data: exs } = await supabase.from('exercises').select('id').in('lesson_id', lessonIds);
  return new Set((exs ?? []).map((e) => e.id));
}

/**
 * Submits one attempt within a session: writes attempt (with session_id),
 * on wrong: tags misconception and checks struggle; updates mastery and spaced_check_count.
 */
export async function submitAttemptForSession(
  sessionId: string,
  exerciseId: string,
  correct: boolean,
  options?: {
    masteryDelta?: number;
    misconceptionTag?: string;
  }
): Promise<SubmitAttemptForSessionResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw new Error(authError.message);
  if (!user) throw new Error('Not authenticated');

  const learnerId = user.id;

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

  const { data: skill } = await supabase.from('skills').select('slug, domain_id').eq('id', skillId).single();
  const skillSlug = skill?.slug ?? '';
  const domainId = skill?.domain_id;
  let domainSlug: DomainSlug = 'math';
  if (domainId) {
    const { data: d } = await supabase.from('domains').select('slug').eq('id', domainId).single();
    if (d?.slug) domainSlug = d.slug as DomainSlug;
  }

  const { data: attemptRow, error: attemptError } = await supabase
    .from('attempts')
    .insert({
      learner_id: learnerId,
      exercise_id: exerciseId,
      correct,
      session_id: sessionId,
    })
    .select('id')
    .single();
  if (attemptError) throw new Error(attemptError.message);
  const attemptId = attemptRow!.id;

  let struggleDetected = false;
  let microLesson: string | undefined;

  if (!correct) {
    const tag = options?.misconceptionTag?.trim() || classifyMisconception({
      domain: domainSlug,
      skillSlug,
      exerciseId,
    });
    await insertAttemptMisconception({
      attemptId,
      learnerId,
      skillId,
      tag,
      exerciseId,
    });
    const recentCounts = await getRecentMisconceptionCounts({
      learnerId,
      skillId,
      windowSize: 20,
    });
    struggleDetected = recentCounts.some((c) => c.count >= 3);
    if (struggleDetected) microLesson = getMicroLessonForTag(tag);
  }

  const now = new Date();
  let updated: { mastery_probability: number; confidence_score: number; attempts_count: number };
  let level: number;
  const useAIMastery = options?.masteryDelta != null;

  if (useAIMastery) {
    const { data: currentMasteryRow } = await supabase
      .from('skill_mastery')
      .select('mastery_probability, confidence_score, attempts_count')
      .eq('learner_id', learnerId)
      .eq('skill_id', skillId)
      .maybeSingle();
    const currentProb = (currentMasteryRow as { mastery_probability?: number } | null)?.mastery_probability ?? 0.3;
    const currentConf = (currentMasteryRow as { confidence_score?: number } | null)?.confidence_score ?? 0;
    const currentAttempts = (currentMasteryRow as { attempts_count?: number } | null)?.attempts_count ?? 0;
    const newProb = Math.max(0, Math.min(1, currentProb + options.masteryDelta!));
    updated = {
      mastery_probability: newProb,
      confidence_score: currentConf + 1,
      attempts_count: currentAttempts + 1,
    };
    level = Math.min(5, Math.max(0, Math.round(updated.mastery_probability * 5)));
  } else {
    const skillExerciseIds = await getExerciseIdsForSkill(supabase, skillId);
    const { data: attemptRows } = await supabase
      .from('attempts')
      .select('exercise_id, correct')
      .eq('learner_id', learnerId);
    const skillAttempts = (attemptRows ?? []).filter((a) => skillExerciseIds.has(a.exercise_id));
    const totalAttempts = skillAttempts.length;
    const totalCorrect = skillAttempts.filter((a) => a.correct).length;
    updated = updateMasteryFromCounts(
      totalAttempts - 1,
      totalCorrect - (correct ? 1 : 0),
      correct
    );
    level = Math.min(5, Math.max(0, Math.round(updated.mastery_probability * 5)));
  }

  const nextReviewAt = scheduleNextReview(correct, updated.mastery_probability, now);

  const { data: currentMastery } = await supabase
    .from('skill_mastery')
    .select('next_review_at, spaced_check_count')
    .eq('learner_id', learnerId)
    .eq('skill_id', skillId)
    .maybeSingle();
  const wasDue = currentMastery?.next_review_at && new Date(currentMastery.next_review_at) <= now;
  const spacedIncrement = correct && wasDue ? 1 : 0;
  const newSpacedCount = ((currentMastery as { spaced_check_count?: number })?.spaced_check_count ?? 0) + spacedIncrement;

  await supabase.from('skill_mastery').upsert(
    {
      learner_id: learnerId,
      skill_id: skillId,
      level,
      mastery_probability: updated.mastery_probability,
      confidence_score: updated.confidence_score,
      attempts_count: updated.attempts_count,
      last_attempt_at: now.toISOString(),
      next_review_at: nextReviewAt.toISOString(),
      spaced_check_count: newSpacedCount,
      updated_at: now.toISOString(),
    },
    { onConflict: 'learner_id,skill_id' }
  );
  await supabase.from('review_schedule').upsert(
    {
      learner_id: learnerId,
      skill_id: skillId,
      next_review_at: nextReviewAt.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: 'learner_id,skill_id' }
  );

  return {
    masteryLevel: level,
    attemptId,
    struggleDetected,
    microLesson,
  };
}
