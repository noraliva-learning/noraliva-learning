/**
 * Deterministic "next exercise" selection for offline progression.
 * Pure logic: given ordered exercises and learner's correct attempts, return the next exercise.
 * Used by getNextExercise server action; unit-tested.
 */

export type ExerciseForSelection = {
  id: string;
  lesson_id: string;
  prompt: string;
  sort_order: number;
};

export type CorrectAttempt = {
  exercise_id: string;
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
