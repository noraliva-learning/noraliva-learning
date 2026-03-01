import { describe, expect, it } from 'vitest';
import {
  selectNextExercise,
  type ExerciseForSelection,
  type CorrectAttempt,
} from './nextExerciseLogic';

const ex = (id: string, prompt: string, sortOrder = 0): ExerciseForSelection => ({
  id,
  lesson_id: 'l1',
  prompt,
  sort_order: sortOrder,
});

describe('selectNextExercise', () => {
  it('returns null when no exercises', () => {
    expect(selectNextExercise([], [])).toBeNull();
  });

  it('returns first exercise when no correct attempts', () => {
    const exercises = [ex('e1', 'Q1', 0), ex('e2', 'Q2', 1)];
    expect(selectNextExercise(exercises, [])).toEqual(exercises[0]);
  });

  it('returns first exercise without a correct attempt', () => {
    const exercises = [ex('e1', 'Q1'), ex('e2', 'Q2'), ex('e3', 'Q3')];
    const correctAttempts: CorrectAttempt[] = [{ exercise_id: 'e1' }];
    expect(selectNextExercise(exercises, correctAttempts)).toEqual(exercises[1]);
  });

  it('returns first exercise when all have correct (review)', () => {
    const exercises = [ex('e1', 'Q1'), ex('e2', 'Q2')];
    const correctAttempts: CorrectAttempt[] = [
      { exercise_id: 'e1' },
      { exercise_id: 'e2' },
    ];
    expect(selectNextExercise(exercises, correctAttempts)).toEqual(exercises[0]);
  });

  it('ignores incorrect attempts when choosing next', () => {
    const exercises = [ex('e1', 'Q1'), ex('e2', 'Q2')];
    const correctAttempts: CorrectAttempt[] = [{ exercise_id: 'e1' }];
    expect(selectNextExercise(exercises, correctAttempts)).toEqual(exercises[1]);
  });

  it('respects order (sort_order already applied in input)', () => {
    const exercises = [ex('e2', 'Q2', 1), ex('e1', 'Q1', 0)];
    expect(selectNextExercise(exercises, [])).toEqual(exercises[0]);
  });
});
