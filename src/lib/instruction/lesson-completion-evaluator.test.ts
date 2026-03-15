import { describe, it, expect } from 'vitest';
import { evaluateLessonCompletion } from './lesson-completion-evaluator';
import type { LessonPlan } from './lesson-plan-schema';

const minimalPlan: LessonPlan = {
  learner_id: '00000000-0000-0000-0000-000000000001',
  domain: 'math',
  skill: 'Counting',
  support_level: 'standard',
  modality: 'mixed',
  scene_sequence: [],
  hint_ladder: [],
  generated_by: 'deterministic',
  version: '1.0',
};

describe('lesson-completion-evaluator', () => {
  it('returns outcome with advance when both tries success, low hints, and prior mastery high', () => {
    const outcome = evaluateLessonCompletion({
      completion: {
        episode_id: '00000000-0000-0000-0000-000000000002',
        guided_try_success: true,
        independent_try_success: true,
        hint_usage_count: 0,
        scene_outcomes: [],
        misconception_signals: [],
      },
      lessonPlan: minimalPlan,
      masteryBefore: {
        skill_id: '00000000-0000-0000-0000-000000000003',
        mastery_probability: 0.8,
        confidence_score: 8,
        attempts_count: 8,
      },
      skillId: '00000000-0000-0000-0000-000000000003',
      skillName: 'Counting',
      domainSkillIds: ['00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004'],
      nextSkillIdInCurriculum: '00000000-0000-0000-0000-000000000004',
      dueReviewSkillIds: [],
    });
    expect(outcome.promotion_decision).toBe('advance');
    expect(outcome.new_mastery_probability).toBeGreaterThan(0.3);
    expect(outcome.next_skill_candidate?.reason).toBe('advance');
  });

  it('returns reteach when independent try failed', () => {
    const outcome = evaluateLessonCompletion({
      completion: {
        episode_id: '00000000-0000-0000-0000-000000000002',
        guided_try_success: true,
        independent_try_success: false,
        hint_usage_count: 0,
        scene_outcomes: [],
        misconception_signals: [],
      },
      lessonPlan: minimalPlan,
      masteryBefore: null,
      skillId: '00000000-0000-0000-0000-000000000003',
      skillName: 'Counting',
      domainSkillIds: [],
      nextSkillIdInCurriculum: null,
      dueReviewSkillIds: [],
    });
    expect(outcome.promotion_decision).toBe('reteach');
    expect(outcome.next_skill_candidate?.reason).toBe('reinforce');
  });

  it('includes review_recommendation and next_review_at', () => {
    const outcome = evaluateLessonCompletion({
      completion: {
        episode_id: '00000000-0000-0000-0000-000000000002',
        guided_try_success: true,
        independent_try_success: true,
        hint_usage_count: 0,
        scene_outcomes: [],
        misconception_signals: [],
      },
      lessonPlan: minimalPlan,
      masteryBefore: {
        skill_id: '00000000-0000-0000-0000-000000000003',
        mastery_probability: 0.5,
        confidence_score: 4,
        attempts_count: 4,
      },
      skillId: '00000000-0000-0000-0000-000000000003',
      skillName: 'Counting',
      domainSkillIds: [],
      nextSkillIdInCurriculum: null,
      dueReviewSkillIds: [],
    });
    expect(outcome.review_recommendation).toBeDefined();
    expect(outcome.next_review_at).toBeDefined();
    expect(outcome.new_attempts_count).toBeGreaterThanOrEqual(5);
  });
});
