import { describe, it, expect } from 'vitest';
import { buildDeterministicLessonPlan } from './deterministic-builder';
import { buildLessonPlanningContext } from './planning-context';
import type { InstructionEngineInput } from './engine-types';

function baseInput(overrides: Partial<InstructionEngineInput> = {}): InstructionEngineInput {
  return {
    learner_id: '00000000-0000-0000-0000-000000000001',
    domain: 'math',
    current_mastery: [],
    recent_attempts: [],
    misconception_history: [],
    hint_usage: [],
    recent_review_schedule: [],
    ...overrides,
  };
}

describe('deterministic-builder', () => {
  it('returns plan and scenes', () => {
    const input = baseInput();
    const { plan, scenes } = buildDeterministicLessonPlan(input);
    expect(plan.learner_id).toBe(input.learner_id);
    expect(plan.domain).toBe('math');
    expect(plan.skill).toBeDefined();
    expect(plan.support_level).toBeDefined();
    expect(plan.generated_by).toBe('deterministic');
    expect(scenes.length).toBeGreaterThanOrEqual(6);
  });

  it('includes focus, concept, worked_example, guided_try, independent_try, celebration', () => {
    const { scenes } = buildDeterministicLessonPlan(baseInput());
    const types = scenes.map((s) => s.type);
    expect(types).toContain('focus_scene');
    expect(types).toContain('concept_card');
    expect(types).toContain('worked_example');
    expect(types).toContain('guided_try');
    expect(types).toContain('independent_try');
    expect(types).toContain('celebration');
  });

  it('uses candidate_skill_name when provided', () => {
    const { plan } = buildDeterministicLessonPlan(
      baseInput({ candidate_skill_name: 'Addition' })
    );
    expect(plan.skill.toLowerCase()).toContain('addition');
  });

  it('sets promotion_decision and promotion_criteria', () => {
    const { plan } = buildDeterministicLessonPlan(baseInput());
    expect(['advance', 'hold', 'review']).toContain(plan.promotion_decision);
    expect(plan.promotion_criteria).toBeDefined();
  });

  it('applies Liv vs Elle defaults for support_level', () => {
    const livInput = baseInput({ learner_slug: 'liv' });
    const elleInput = baseInput({ learner_slug: 'elle' });
    const liv = buildDeterministicLessonPlan(livInput, buildLessonPlanningContext(livInput));
    const elle = buildDeterministicLessonPlan(elleInput, buildLessonPlanningContext(elleInput));
    expect(liv.plan.support_level).toBe('light');
    expect(elle.plan.support_level).toBe('standard');
  });

  it('Phase 5: nudge support_level when context has hint_dependent_success', () => {
    const livInput = baseInput({ learner_slug: 'liv' });
    const withHintInput = baseInput({
      learner_slug: 'liv',
      learner_insights: [{ insight_type: 'hint_dependent_success', summary_plain_english: 'Succeeds with hints.' }],
    });
    const without = buildDeterministicLessonPlan(livInput, buildLessonPlanningContext(livInput));
    const withHintInsight = buildDeterministicLessonPlan(withHintInput, buildLessonPlanningContext(withHintInput));
    expect(without.plan.support_level).toBe('light');
    expect(withHintInsight.plan.support_level).toBe('standard');
  });

  it('Phase 5: set modality to visual when context has workmat_visual_success', () => {
    const withWorkmatInput = baseInput({
      learner_slug: 'liv',
      learner_insights: [{ insight_type: 'workmat_visual_success', summary_plain_english: 'Learns well with Work Mat.' }],
    });
    const withWorkmat = buildDeterministicLessonPlan(withWorkmatInput, buildLessonPlanningContext(withWorkmatInput));
    expect(withWorkmat.plan.modality).toBe('visual');
  });

  it('Phase 5B: attaches ace_planning_metadata when context is provided', () => {
    const input = baseInput({ learner_slug: 'liv', candidate_skill_name: 'Counting' });
    const context = buildLessonPlanningContext(input);
    const { plan } = buildDeterministicLessonPlan(input, context);
    expect(plan.ace_planning_metadata).toBeDefined();
    expect(plan.ace_planning_metadata?.planning_context_version).toBeDefined();
    expect(plan.ace_planning_metadata?.support_level_chosen).toBe(plan.support_level);
    expect(plan.ace_planning_metadata?.modality_chosen).toBe(plan.modality);
    expect(plan.ace_planning_metadata?.insight_types_considered).toEqual([]);
    expect(plan.ace_planning_metadata?.why_this_lesson_summary).toBeDefined();
  });

  it('Phase 5B: sets influenced_by_learner_insights when insights nudge support or modality', () => {
    const input = baseInput({
      learner_slug: 'liv',
      learner_insights: [{ insight_type: 'workmat_visual_success', summary_plain_english: 'Visual learner.' }],
    });
    const context = buildLessonPlanningContext(input);
    const { plan } = buildDeterministicLessonPlan(input, context);
    expect(plan.ace_planning_metadata?.influenced_by_learner_insights).toBe(true);
    expect(plan.ace_planning_metadata?.modality_chosen).toBe('visual');
  });

  it('Phase 6: includes visual_teaching_sequence when modality is visual', () => {
    const input = baseInput({
      learner_slug: 'liv',
      learner_insights: [{ insight_type: 'workmat_visual_success', summary_plain_english: 'Visual.' }],
      candidate_skill_name: 'Equal groups',
    });
    const context = buildLessonPlanningContext(input);
    const { plan, scenes } = buildDeterministicLessonPlan(input, context);
    const vts = scenes.find((s) => s.type === 'visual_teaching_sequence');
    expect(vts).toBeDefined();
    expect(vts?.type).toBe('visual_teaching_sequence');
    expect((vts as { steps: unknown[] }).steps.length).toBeGreaterThanOrEqual(1);
    expect(plan.scene_sequence).toEqual(scenes);
    const idxFocus = scenes.findIndex((s) => s.type === 'focus_scene');
    const idxVts = scenes.findIndex((s) => s.type === 'visual_teaching_sequence');
    const idxConcept = scenes.findIndex((s) => s.type === 'concept_card');
    expect(idxFocus).toBe(0);
    expect(idxVts).toBe(1);
    expect(idxConcept).toBe(2);
  });

  it('Phase 6: no visual_teaching_sequence when modality is not visual and no misconceptions', () => {
    const input = baseInput({ learner_slug: 'liv', candidate_skill_name: 'Counting' });
    const context = buildLessonPlanningContext(input);
    const { scenes } = buildDeterministicLessonPlan(input, context);
    const vts = scenes.find((s) => s.type === 'visual_teaching_sequence');
    expect(vts).toBeUndefined();
  });

  it('Phase 7: reading domain returns plan with domain reading and reading skill', () => {
    const input = baseInput({
      domain: 'reading',
      learner_slug: 'liv',
      candidate_skill_name: 'Letter recognition',
    });
    const context = buildLessonPlanningContext(input);
    const { plan, scenes } = buildDeterministicLessonPlan(input, context);
    expect(plan.domain).toBe('reading');
    expect(plan.skill).toBe('Letter recognition');
    expect(plan.scene_sequence).toEqual(scenes);
    expect(scenes.some((s) => s.type === 'focus_scene')).toBe(true);
    expect(scenes.some((s) => s.type === 'concept_card')).toBe(true);
    expect(scenes.some((s) => s.type === 'guided_try')).toBe(true);
    expect(scenes.some((s) => s.type === 'celebration')).toBe(true);
  });

  it('Phase 7: reading plan includes visual_teaching_sequence when modality is visual', () => {
    const input = baseInput({
      domain: 'reading',
      learner_slug: 'liv',
      candidate_skill_name: 'Letter sounds',
      learner_insights: [{ insight_type: 'workmat_visual_success', summary_plain_english: 'Visual.' }],
    });
    const context = buildLessonPlanningContext(input);
    const { scenes } = buildDeterministicLessonPlan(input, context);
    const vts = scenes.find((s) => s.type === 'visual_teaching_sequence');
    expect(vts).toBeDefined();
    expect((vts as { steps: unknown[] }).steps.length).toBeGreaterThanOrEqual(1);
  });
});
