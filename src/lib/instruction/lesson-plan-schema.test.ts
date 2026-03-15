import { describe, it, expect } from 'vitest';
import { lessonPlanSchema, validateLessonPlan, supportLevelSchema, promotionDecisionSchema } from './lesson-plan-schema';

describe('lesson-plan-schema', () => {
  const minimalPlan = {
    learner_id: '00000000-0000-0000-0000-000000000001',
    domain: 'math',
    skill: 'Counting',
    support_level: 'standard',
    modality: 'mixed',
    scene_sequence: [
      { id: 'f1', type: 'focus_scene', display_text: 'Focus' },
      { id: 'c1', type: 'celebration', display_text: 'Done!' },
    ],
  };

  it('validates minimal lesson plan', () => {
    const out = lessonPlanSchema.parse(minimalPlan);
    expect(out.learner_id).toBe(minimalPlan.learner_id);
    expect(out.domain).toBe('math');
    expect(out.scene_sequence).toHaveLength(2);
    expect(out.generated_by).toBe('deterministic');
    expect(out.version).toBe('1.0');
  });

  it('validates full plan with promotion and fallback', () => {
    const full = {
      ...minimalPlan,
      why_next: 'Next skill in sequence.',
      hint_ladder: ['Hint 1', 'Hint 2'],
      promotion_criteria: { correct_independent_try: true },
      promotion_decision: 'advance' as const,
      fallback_retry_plan: { retry_scenes: ['guided_try'] },
      generated_by: 'openai' as const,
    };
    const out = validateLessonPlan(full);
    expect(out.promotion_decision).toBe('advance');
    expect(out.fallback_retry_plan?.retry_scenes).toEqual(['guided_try']);
  });

  it('rejects invalid support_level', () => {
    expect(() => supportLevelSchema.parse('invalid')).toThrow();
    expect(supportLevelSchema.parse('heavy')).toBe('heavy');
  });

  it('rejects invalid promotion_decision', () => {
    expect(() => promotionDecisionSchema.parse('skip')).toThrow();
    expect(promotionDecisionSchema.parse('hold')).toBe('hold');
  });

  it('Phase 6: validates plan with visual_teaching_sequence in scene_sequence', () => {
    const planWithVts = {
      ...minimalPlan,
      scene_sequence: [
        { id: 'f1', type: 'focus_scene', display_text: 'Focus' },
        {
          id: 'v1',
          type: 'visual_teaching_sequence',
          voiceover_text: 'Equal groups.',
          steps: [
            { animation: 'groups_appear' },
            { animation: 'dots_fill_groups' },
          ],
        },
        { id: 'c1', type: 'celebration', display_text: 'Done!' },
      ],
    };
    const out = lessonPlanSchema.parse(planWithVts);
    expect(out.scene_sequence).toHaveLength(3);
    expect(out.scene_sequence[1].type).toBe('visual_teaching_sequence');
    expect((out.scene_sequence[1] as { steps: { animation: string }[] }).steps).toHaveLength(2);
  });
});
