import { describe, expect, it } from 'vitest';
import {
  selectNextExercise,
  selectNextExerciseWithMastery,
  type ExerciseForSelection,
  type CorrectAttempt,
  type MasteryForSkill,
} from './nextExerciseLogic';

const ex = (
  id: string,
  prompt: string,
  sortOrder = 0,
  skillId = 's1'
): ExerciseForSelection => ({
  id,
  lesson_id: 'l1',
  skill_id: skillId,
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

describe('selectNextExerciseWithMastery', () => {
  const emptyMastery = new Map<string, MasteryForSkill>();
  const noDue = new Set<string>();

  it('returns null when no exercises', () => {
    expect(
      selectNextExerciseWithMastery([], [], emptyMastery, noDue, null)
    ).toBeNull();
  });

  it('excludes lastExerciseId (never repeat same exercise)', () => {
    const exercises = [ex('e1', 'Q1'), ex('e2', 'Q2')];
    const next = selectNextExerciseWithMastery(
      exercises,
      [],
      emptyMastery,
      noDue,
      'e1'
    );
    expect(next?.id).toBe('e2');
  });

  it('returns null when only candidate is lastExerciseId', () => {
    const exercises = [ex('e1', 'Q1')];
    const next = selectNextExerciseWithMastery(
      exercises,
      [],
      emptyMastery,
      noDue,
      'e1'
    );
    expect(next).toBeNull();
  });

  it('prioritizes due review skills', () => {
    const exercises = [
      ex('e1', 'Q1', 0, 's1'),
      ex('e2', 'Q2', 1, 's2'),
      ex('e3', 'Q3', 2, 's2'),
    ];
    const due = new Set<string>(['s2']);
    const next = selectNextExerciseWithMastery(
      exercises,
      [],
      emptyMastery,
      due,
      null
    );
    expect(next).not.toBeNull();
    expect(['e2', 'e3']).toContain(next!.id);
  });

  it('prefers edge-of-learning skills over curriculum order', () => {
    const exercises = [
      ex('e1', 'Q1', 0, 's1'),
      ex('e2', 'Q2', 1, 's2'),
      ex('e3', 'Q3', 2, 's3'),
    ];
    const mastery = new Map<string, MasteryForSkill>([
      ['s1', { mastery_probability: 0.9, confidence_score: 10, next_review_at: null }],
      ['s2', { mastery_probability: 0.55, confidence_score: 5, next_review_at: null }],
      ['s3', { mastery_probability: 0.2, confidence_score: 2, next_review_at: null }],
    ]);
    const next = selectNextExerciseWithMastery(
      exercises,
      [],
      mastery,
      noDue,
      null
    );
    expect(next).not.toBeNull();
    expect(next!.skill_id).toBe('s2');
  });

  it('falls back to curriculum order when no due and no mastery data', () => {
    const exercises = [ex('e1', 'Q1'), ex('e2', 'Q2')];
    const next = selectNextExerciseWithMastery(
      exercises,
      [],
      emptyMastery,
      noDue,
      null
    );
    expect(next).toEqual(exercises[0]);
  });
});
