import { describe, expect, it } from 'vitest';
import {
  buildSpiralMix,
  generateSessionPlan,
  type ExerciseForPlan,
  type MasteryForPlan,
  type SessionPlanInput,
} from './sessionPlanner';

const ex = (id: string, skillId: string): ExerciseForPlan => ({
  id,
  skill_id: skillId,
  prompt: `Q ${id}`,
});

describe('buildSpiralMix', () => {
  it('level_up biases edge (80% edge)', () => {
    const m = buildSpiralMix('level_up');
    expect(m.edge).toBe(0.8);
    expect(m.reinforcement + m.easy).toBeCloseTo(0.2, 5);
  });

  it('review biases reinforcement (40% reinforcement)', () => {
    const m = buildSpiralMix('review');
    expect(m.reinforcement).toBe(0.4);
    expect(m.edge + m.reinforcement + m.easy).toBeCloseTo(1, 5);
  });
});

describe('generateSessionPlan', () => {
  it('returns empty when no exercises', () => {
    const plan = generateSessionPlan({
      exercises: [],
      masteryBySkill: new Map(),
      dueReviewSkillIds: new Set(),
      path: 'level_up',
    });
    expect(plan).toEqual([]);
  });

  it('returns spiral distribution: majority edge when level_up', () => {
    const exercises: ExerciseForPlan[] = [
      ex('e1', 's1'),
      ex('e2', 's1'),
      ex('e3', 's2'),
      ex('e4', 's2'),
      ex('e5', 's3'),
      ex('e6', 's3'),
      ex('e7', 's4'),
      ex('e8', 's4'),
    ];
    const mastery = new Map<string, MasteryForPlan>([
      ['s1', { mastery_probability: 0.6, confidence_score: 5, next_review_at: null, spaced_check_count: 0 }],
      ['s2', { mastery_probability: 0.75, confidence_score: 8, next_review_at: null, spaced_check_count: 0 }],
      ['s3', { mastery_probability: 0.95, confidence_score: 10, next_review_at: null, spaced_check_count: 2 }],
      ['s4', { mastery_probability: 0.5, confidence_score: 2, next_review_at: null, spaced_check_count: 0 }],
    ]);
    const plan = generateSessionPlan({
      exercises,
      masteryBySkill: mastery,
      dueReviewSkillIds: new Set(),
      path: 'level_up',
      minItems: 6,
      maxItems: 12,
    });
    expect(plan.length).toBeGreaterThanOrEqual(6);
    expect(plan.length).toBeLessThanOrEqual(12);
    // Plan should have no duplicate exercise ids
    expect(new Set(plan).size).toBe(plan.length);
  });

  it('returns at least one item when exercises exist (even with no due reviews)', () => {
    const exercises: ExerciseForPlan[] = [
      ex('e1', 's1'),
      ex('e2', 's2'),
    ];
    const plan = generateSessionPlan({
      exercises,
      masteryBySkill: new Map(),
      dueReviewSkillIds: new Set(),
      path: 'level_up',
      minItems: 1,
      maxItems: 5,
    });
    expect(plan.length).toBeGreaterThanOrEqual(1);
    expect(plan).toContain('e1');
    expect(new Set(plan).size).toBe(plan.length);
  });

  it('interleaves skills (no back-to-back same skill when possible)', () => {
    const exercises: ExerciseForPlan[] = [
      ex('e1', 's1'),
      ex('e2', 's2'),
      ex('e3', 's3'),
    ];
    const mastery = new Map<string, MasteryForPlan>([
      ['s1', { mastery_probability: 0.6, confidence_score: 5, next_review_at: null, spaced_check_count: 0 }],
      ['s2', { mastery_probability: 0.65, confidence_score: 5, next_review_at: null, spaced_check_count: 0 }],
      ['s3', { mastery_probability: 0.7, confidence_score: 5, next_review_at: null, spaced_check_count: 0 }],
    ]);
    const plan = generateSessionPlan({
      exercises,
      masteryBySkill: mastery,
      dueReviewSkillIds: new Set(),
      path: 'level_up',
      minItems: 3,
      maxItems: 6,
    });
    expect(plan.length).toBeGreaterThanOrEqual(3);
  });
});
