/**
 * Deterministic "next exercise" selection for offline progression.
 * Pure logic: given ordered exercises and learner's correct attempts, return the next exercise.
 * Used by getNextExercise server action; unit-tested.
 */

import { edgeOfLearningScore } from '@/lib/mastery/masteryEngine';

export type ExerciseForSelection = {
  id: string;
  lesson_id: string;
  skill_id: string;
  prompt: string;
  sort_order: number;
};

export type CorrectAttempt = {
  exercise_id: string;
};

export type MasteryForSkill = {
  mastery_probability: number;
  confidence_score: number;
  next_review_at: string | null;
};

/**
 * Returns the next exercise for the learner in curriculum order.
 * - Order: by sort_order (already assumed from DB: unit -> skill -> lesson -> exercise).
 * - Pick the first exercise that does NOT have a correct attempt from this learner.
 * - If all exercises have at least one correct attempt, return the first exercise (review).
 */
export function selectNextExercise(
  exercises: ExerciseForSelection[],
  correctAttempts: CorrectAttempt[]
): ExerciseForSelection | null {
  if (exercises.length === 0) return null;

  const correctSet = new Set(correctAttempts.map((a) => a.exercise_id));

  const firstWithoutCorrect = exercises.find((ex) => !correctSet.has(ex.id));
  if (firstWithoutCorrect) return firstWithoutCorrect;

  return exercises[0];
}

/**
 * Next exercise with Noraliva Mastery Engine: prioritize due reviews, then edge-of-learning skills,
 * then curriculum order. Never returns the same exercise as lastExerciseId.
 */
export function selectNextExerciseWithMastery(
  exercises: ExerciseForSelection[],
  correctAttempts: CorrectAttempt[],
  masteryBySkill: Map<string, MasteryForSkill>,
  dueReviewSkillIds: Set<string>,
  lastExerciseId: string | null
): ExerciseForSelection | null {
  if (exercises.length === 0) return null;

  const correctSet = new Set(correctAttempts.map((a) => a.exercise_id));
  const excludeId = lastExerciseId ?? '';
  const candidates = excludeId ? exercises.filter((ex) => ex.id !== excludeId) : exercises;
  if (candidates.length === 0) return null;

  const now = new Date().toISOString();

  // 1) Due reviews: exercises in skills that are due for review
  const dueExercises = candidates.filter((ex) => dueReviewSkillIds.has(ex.skill_id));
  if (dueExercises.length > 0) {
    const withoutCorrect = dueExercises.find((ex) => !correctSet.has(ex.id));
    if (withoutCorrect) return withoutCorrect;
    return dueExercises[0];
  }

  // 2) Edge-of-learning: score each skill, pick best exercise from best skills
  const skillScores = new Map<string, number>();
  for (const ex of candidates) {
    if (skillScores.has(ex.skill_id)) continue;
    const m = masteryBySkill.get(ex.skill_id);
    const prob = m?.mastery_probability ?? 0.3;
    const conf = m?.confidence_score ?? 0;
    skillScores.set(ex.skill_id, edgeOfLearningScore(prob, conf));
  }
  const sortedSkillIds = [...skillScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  for (const skillId of sortedSkillIds) {
    const inSkill = candidates.filter((ex) => ex.skill_id === skillId);
    const withoutCorrect = inSkill.find((ex) => !correctSet.has(ex.id));
    if (withoutCorrect) return withoutCorrect;
    if (inSkill.length > 0) return inSkill[0];
  }

  // 3) Fallback: curriculum order (first without correct, else first)
  const next = selectNextExercise(candidates, correctAttempts);
  return next;
}
