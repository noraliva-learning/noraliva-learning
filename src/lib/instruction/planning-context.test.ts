import { describe, it, expect } from 'vitest';
import { buildLessonPlanningContext, buildWhyThisLessonSummary } from './planning-context';
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

describe('planning-context', () => {
  it('builds context with version, learner_id, domain, candidate skill', () => {
    const input = baseInput({
      candidate_skill_id: '00000000-0000-0000-0000-000000000002',
      candidate_skill_name: 'Addition',
    });
    const ctx = buildLessonPlanningContext(input);
    expect(ctx.version).toBeDefined();
    expect(ctx.learner_id).toBe(input.learner_id);
    expect(ctx.domain).toBe('math');
    expect(ctx.candidate_skill_id).toBe(input.candidate_skill_id);
    expect(ctx.candidate_skill_name).toBe('Addition');
  });

  it('includes mastery_summary and misconception_tags', () => {
    const input = baseInput({
      current_mastery: [
        {
          skill_id: 's1',
          mastery_probability: 0.8,
          confidence_score: 0.9,
          next_review_at: null,
          spaced_check_count: 0,
        },
      ],
      misconception_history: [
        { skill_id: null, tag: 'counting-back', created_at: new Date().toISOString() },
      ],
    });
    const ctx = buildLessonPlanningContext(input);
    expect(ctx.mastery_summary).toContain('80%');
    expect(ctx.misconception_tags).toContain('counting-back');
  });

  it('recommended_support_level nudges up when hint_dependent_success', () => {
    const livInput = baseInput({ learner_slug: 'liv' });
    const ctxDefault = buildLessonPlanningContext(livInput);
    expect(ctxDefault.recommended_support_level).toBe('light');

    const withHint = baseInput({
      learner_slug: 'liv',
      learner_insights: [{ insight_type: 'hint_dependent_success', summary_plain_english: 'Uses hints.' }],
    });
    const ctxHint = buildLessonPlanningContext(withHint);
    expect(ctxHint.recommended_support_level).toBe('standard');
  });

  it('recommended_modality is visual when workmat_visual_success or prefers_narration_replay', () => {
    const livInput = baseInput({ learner_slug: 'liv' });
    const ctxDefault = buildLessonPlanningContext(livInput);
    expect(ctxDefault.recommended_modality).toBe('mixed');

    const withWorkmat = baseInput({
      learner_slug: 'liv',
      learner_insights: [{ insight_type: 'workmat_visual_success', summary_plain_english: 'Work Mat helps.' }],
    });
    const ctxWorkmat = buildLessonPlanningContext(withWorkmat);
    expect(ctxWorkmat.recommended_modality).toBe('visual');
  });

  it('planning_summary_for_prompt includes learner signals and candidate skill', () => {
    const input = baseInput({
      candidate_skill_name: 'Subtraction',
      learner_insights: [
        { insight_type: 'guided_not_independent_gap', summary_plain_english: 'Needs guided practice.' },
      ],
    });
    const ctx = buildLessonPlanningContext(input);
    expect(ctx.planning_summary_for_prompt).toContain('Subtraction');
    expect(ctx.planning_summary_for_prompt).toContain('guided');
    expect(ctx.planning_summary_for_prompt).toContain('Learner signals');
  });

  it('buildMetadata returns insight_types_considered and influenced_by_learner_insights', () => {
    const withInsight = baseInput({
      learner_slug: 'liv',
      learner_insights: [{ insight_type: 'workmat_visual_success', summary_plain_english: 'Visual.' }],
    });
    const ctx = buildLessonPlanningContext(withInsight);
    const meta = ctx.buildMetadata({
      support_level_chosen: 'light',
      modality_chosen: 'visual',
      skill_name: 'Counting',
      why_advance_or_hold: 'Visual lesson for this learner.',
    });
    expect(meta.planning_context_version).toBeDefined();
    expect(meta.insight_types_considered).toContain('workmat_visual_success');
    expect(meta.support_level_chosen).toBe('light');
    expect(meta.modality_chosen).toBe('visual');
    expect(meta.influenced_by_learner_insights).toBe(true);
    expect(meta.why_this_lesson_summary).toBe('Visual lesson for this learner.');
  });

  it('buildWhyThisLessonSummary includes skill and support/modality', () => {
    const input = baseInput({ learner_slug: 'liv' });
    const ctx = buildLessonPlanningContext(input);
    const summary = buildWhyThisLessonSummary(ctx, 'Addition', 'light', 'mixed', 'deterministic');
    expect(summary).toContain('Addition');
    expect(summary).toContain('light');
    expect(summary).toContain('mixed');
    expect(summary).toContain('deterministic');
  });
});
