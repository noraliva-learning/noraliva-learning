import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateLessonPlan, buildSystemPrompt } from './instruction-engine';
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

describe('instruction-engine', () => {
  const envRestore: Record<string, string | undefined> = {};
  beforeEach(() => {
    envRestore.ACE_INSTRUCTION_ENGINE_OPENAI = process.env.ACE_INSTRUCTION_ENGINE_OPENAI;
    process.env.ACE_INSTRUCTION_ENGINE_OPENAI = 'false';
  });
  afterEach(() => {
    if (envRestore.ACE_INSTRUCTION_ENGINE_OPENAI !== undefined) {
      process.env.ACE_INSTRUCTION_ENGINE_OPENAI = envRestore.ACE_INSTRUCTION_ENGINE_OPENAI;
    }
  });

  it('returns plan with ace_planning_metadata when using deterministic path', async () => {
    const input = baseInput({ learner_slug: 'liv', candidate_skill_name: 'Counting' });
    const { plan } = await generateLessonPlan(input);
    expect(plan.generated_by).toBe('deterministic');
    expect(plan.ace_planning_metadata).toBeDefined();
    expect(plan.ace_planning_metadata?.planning_context_version).toBeDefined();
    expect(plan.ace_planning_metadata?.support_level_chosen).toBe(plan.support_level);
    expect(plan.ace_planning_metadata?.modality_chosen).toBe(plan.modality);
    expect(plan.ace_planning_metadata?.why_this_lesson_summary).toBeDefined();
  });

  it('buildSystemPrompt includes planning_summary_for_prompt in user message', () => {
    const input = baseInput({
      candidate_skill_name: 'Addition',
      learner_insights: [{ insight_type: 'workmat_visual_success', summary_plain_english: 'Visual learner.' }],
    });
    const context = buildLessonPlanningContext(input);
    const { system, user } = buildSystemPrompt(input, context);
    expect(user).toContain(context.planning_summary_for_prompt);
    expect(user).toContain('Planning context');
  });

  it('buildSystemPrompt includes learner-strategy instructions in system message', () => {
    const input = baseInput();
    const context = buildLessonPlanningContext(input);
    const { system } = buildSystemPrompt(input, context);
    expect(system).toContain('learns best visually');
    expect(system).toContain('needs narration');
    expect(system).toContain('succeeds only in guided mode');
    expect(system).toContain('Work Mat');
    expect(system).toContain('text load');
    expect(system).toContain('bridging');
  });
});
