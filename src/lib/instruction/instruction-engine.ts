/**
 * Phase 3: Ace Instruction Engine — generates structured lesson plan from learner state.
 * Phase 5B: Unified planning context (learner insights, mastery, misconceptions) for both OpenAI and deterministic paths.
 */

import type { InstructionEngineInput, InstructionEngineOutput } from './engine-types';
import { buildDeterministicLessonPlan } from './deterministic-builder';
import type { LessonPlanningContext } from './planning-context';
import { buildLessonPlanningContext, buildWhyThisLessonSummary } from './planning-context';
import { lessonPlanSchema } from './lesson-plan-schema';

const OPENAI_ENABLED = process.env.ACE_INSTRUCTION_ENGINE_OPENAI === 'true';

/**
 * Generate a lesson plan for the learner. Prefer OpenAI if configured and domain is supported.
 * Phase 5B: Build planning context once and pass to both paths; both attach ace_planning_metadata.
 */
export async function generateLessonPlan(input: InstructionEngineInput): Promise<InstructionEngineOutput> {
  const context = buildLessonPlanningContext(input);
  if (OPENAI_ENABLED && (input.domain === 'math' || input.domain === 'reading')) {
    try {
      const result = await generateLessonPlanOpenAI(input, context);
      if (result) return result;
    } catch (err) {
      console.warn('[instruction-engine] OpenAI generation failed, using deterministic fallback', err);
    }
  }
  return buildDeterministicLessonPlan(input, context);
}

async function generateLessonPlanOpenAI(
  input: InstructionEngineInput,
  context: LessonPlanningContext
): Promise<InstructionEngineOutput | null> {
  const { getOpenAIClient } = await import('@/lib/openai');
  let client;
  try {
    client = getOpenAIClient();
  } catch {
    return null;
  }

  const prompt = buildSystemPrompt(input, context);
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_DAN_MODEL?.trim() || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const raw = JSON.parse(content);
    if (typeof raw !== 'object' || raw === null) return null;
    const basePlan = {
      ...(raw as Record<string, unknown>),
      learner_id: input.learner_id,
      domain: input.domain,
      generated_by: 'openai',
    };
    const plan = lessonPlanSchema.parse(basePlan);
    const support_level = plan.support_level;
    const modality = plan.modality;
    const skillName = plan.skill;
    const whySummary = buildWhyThisLessonSummary(context, skillName, support_level, modality, 'openai');
    const ace_planning_metadata = context.buildMetadata({
      support_level_chosen: support_level,
      modality_chosen: modality,
      skill_name: skillName,
      why_advance_or_hold: whySummary,
    });
    const planWithMetadata = { ...plan, ace_planning_metadata };
    return { plan: planWithMetadata, scenes: plan.scene_sequence };
  } catch {
    return null;
  }
}

const LEARNER_STRATEGY_BLOCK = `
Use the learner planning context below to choose support_level and modality. You must explicitly consider:
- Whether the child learns best visually → prefer support_level that allows visual modeling and use modality "visual"; include voiceover_text on scenes.
- Whether the child needs narration → prefer scenes with voiceover_text; avoid text-heavy display_text only.
- Whether the child succeeds only in guided mode (guided_not_independent_gap) → prefer standard or heavy support; include guided_try and avoid rushing to independent_try.
- Whether the child benefits from Work Mat interaction (workmat_visual_success) → prefer visual modality and manipulative/workmat-style scenes.
- Whether text load should be reduced (prefers_narration_replay) → keep display_text minimal; put explanation in voiceover_text.
- Whether a bridging concept is better than pushing ahead → if misconceptions or weak mastery appear, prefer review or a bridging skill over advancing.
Output a single JSON object (no markdown).`;

/** Exported for tests: verify prompt includes planning context and learner-strategy instructions */
export function buildSystemPrompt(
  input: InstructionEngineInput,
  context: LessonPlanningContext
): { system: string; user: string } {
  const system = `You are the Ace Instruction Engine for a kid-friendly learning app. Generate a single lesson plan as JSON.
Output must match this shape (use only these keys): learner_id (string UUID), domain (string), skill (string), skill_id (string UUID optional), why_next (string), support_level (one of: minimal, light, standard, heavy, full_guided), modality (one of: visual, verbal, kinesthetic, mixed), scene_sequence (array of scene objects), hint_ladder (array of strings), promotion_criteria (object with optional correct_independent_try, min_mastery_delta, require_spaced_check), promotion_decision (one of: advance, hold, review), fallback_retry_plan (object with optional retry_scenes array, alternative_skill_id), generated_by ("openai"), version ("1.0").
Each scene in scene_sequence must have: id (string), type (one of: focus_scene, visual_teaching_sequence, concept_card, worked_example, manipulative, guided_try, independent_try, hint_step, celebration), domain (string optional), skill (string optional), display_text (string optional), voiceover_text (string optional), animation_type (optional), objects (array optional), interaction_type (optional), expected_answer (optional, for guided_try/independent_try), validation_rule (optional), hints (array optional). For type visual_teaching_sequence use steps (array of { animation: one of groups_appear, dots_fill_groups, highlight_rows, rotate_to_array, object_appear, grouping, highlighting, counting, combine_groups, take_away, structure_reveal, number_line_jump, rotation, transformation }). Use visual_teaching_sequence before concept_card when introducing a new concept, when misconceptions are present, or when the learner prefers visual modality. Keep content short and kid-friendly. For math: counting, addition, subtraction, equal groups. For reading: letter recognition, letter sounds, phoneme matching, blending CVC, segmenting, sight words, simple sentence reading.
${LEARNER_STRATEGY_BLOCK}`;

  const user = `Learner ${input.learner_id}, domain: ${input.domain}. Planning context (use this to choose support_level and modality): ${context.planning_summary_for_prompt}. Return a single JSON object (no markdown).`;

  return { system, user };
}
