/**
 * Phase 5B: Unified lesson planning context for Ace (deterministic + OpenAI).
 * Builds a single high-signal context from learner state and insights.
 */

import type { InstructionEngineInput } from './engine-types';
import type { SupportLevel, Modality } from './lesson-plan-schema';
import type { AcePlanningMetadata } from './lesson-plan-schema';
import { getLearnerInstructionDefaults } from './learner-defaults';

const PLANNING_CONTEXT_VERSION = '1.0';

export type LessonPlanningContext = {
  version: string;
  learner_id: string;
  learner_slug?: 'liv' | 'elle';
  domain: string;
  candidate_skill_id: string | null;
  candidate_skill_name: string | null;
  /** Mastery: top skills with P and confidence */
  mastery_summary: string;
  /** Due review skill ids */
  due_review_skill_ids: string[];
  /** Recent lesson count */
  recent_attempts_count: number;
  /** Misconception tags (compact) */
  misconception_tags: string[];
  /** Learner insights in plain English (for prompt and prior) */
  insight_summaries: string[];
  /** Insight types present (for metadata) */
  insight_types: string[];
  /** Recommended support level from insights + defaults */
  recommended_support_level: SupportLevel;
  /** Recommended modality from insights + defaults */
  recommended_modality: Modality;
  /** Compact planning summary for OpenAI (high-signal, no noise) */
  planning_summary_for_prompt: string;
  /** Build metadata for the chosen plan (call after skill/support/modality are chosen) */
  buildMetadata: (opts: {
    support_level_chosen: SupportLevel;
    modality_chosen: Modality;
    skill_name: string;
    why_advance_or_hold?: string;
  }) => AcePlanningMetadata;
};

function nudgeSupportFromInsights(
  defaultLevel: SupportLevel,
  insightTypes: Set<string>
): SupportLevel {
  if (insightTypes.has('hint_dependent_success') || insightTypes.has('guided_not_independent_gap')) {
    if (defaultLevel === 'minimal') return 'light';
    if (defaultLevel === 'light') return 'standard';
  }
  return defaultLevel;
}

function nudgeModalityFromInsights(
  defaultModality: Modality,
  insightTypes: Set<string>
): Modality {
  if (insightTypes.has('workmat_visual_success') || insightTypes.has('prefers_narration_replay')) {
    return 'visual';
  }
  return defaultModality;
}

/**
 * Build the unified lesson planning context used by both deterministic and OpenAI paths.
 */
export function buildLessonPlanningContext(input: InstructionEngineInput): LessonPlanningContext {
  const defaults = getLearnerInstructionDefaults(input.learner_slug ?? 'liv');
  const insights = input.learner_insights ?? [];
  const insightTypes = new Set(insights.map((i) => i.insight_type));
  const recommended_support_level = nudgeSupportFromInsights(defaults.support_level, insightTypes);
  const recommended_modality = nudgeModalityFromInsights(defaults.modality, insightTypes);

  const mastery_summary =
    input.current_mastery
      .slice(0, 10)
      .map(
        (m) =>
          `P=${(m.mastery_probability * 100).toFixed(0)}% conf=${(m.confidence_score * 100).toFixed(0)}%`
      )
      .join('; ') || 'none';

  const misconception_tags = [...new Set(input.misconception_history.map((m) => m.tag))].slice(0, 8);

  const insight_summaries = insights.map((i) => i.summary_plain_english);
  const insight_types = [...insightTypes];

  const dueReviewSkillIds: string[] = [];
  const now = new Date().toISOString();
  for (const r of input.recent_review_schedule) {
    if (r.next_review_at <= now) dueReviewSkillIds.push(r.skill_id);
  }

  const planning_summary_for_prompt = buildCompactPlanningSummary(input, insight_summaries, insight_types);

  return {
    version: PLANNING_CONTEXT_VERSION,
    learner_id: input.learner_id,
    learner_slug: input.learner_slug,
    domain: input.domain,
    candidate_skill_id: input.candidate_skill_id ?? null,
    candidate_skill_name: input.candidate_skill_name ?? null,
    mastery_summary,
    due_review_skill_ids: dueReviewSkillIds,
    recent_attempts_count: input.recent_attempts.length,
    misconception_tags,
    insight_summaries,
    insight_types,
    recommended_support_level,
    recommended_modality,
    planning_summary_for_prompt,
    buildMetadata(opts) {
      const influenced =
        insight_types.length > 0 &&
        (opts.support_level_chosen !== defaults.support_level ||
          opts.modality_chosen !== defaults.modality);
      return {
        planning_context_version: PLANNING_CONTEXT_VERSION,
        insight_types_considered: insight_types,
        support_level_chosen: opts.support_level_chosen,
        modality_chosen: opts.modality_chosen,
        influenced_by_learner_insights: influenced,
        why_this_lesson_summary: opts.why_advance_or_hold,
      };
    },
  };
}

function buildCompactPlanningSummary(
  input: InstructionEngineInput,
  insightSummaries: string[],
  insightTypes: string[]
): string {
  const parts: string[] = [];
  parts.push(`Mastery: ${input.current_mastery.length} skills; recent attempts: ${input.recent_attempts.length}.`);
  if (input.misconception_history.length > 0) {
    const tags = [...new Set(input.misconception_history.map((m) => m.tag))].slice(0, 5).join(', ');
    parts.push(`Misconceptions to consider: ${tags}.`);
  }
  if (insightSummaries.length > 0) {
    parts.push('Learner signals: ' + insightSummaries.slice(0, 6).join(' ') + '.');
  }
  if (insightTypes.includes('guided_not_independent_gap')) {
    parts.push('Child succeeds with support but not yet independently; consider guided practice and bridging.');
  }
  if (insightTypes.includes('workmat_visual_success')) {
    parts.push('Child learns well with visual modeling and Work Mat; prefer visual modality and manipulatives.');
  }
  if (insightTypes.includes('prefers_narration_replay')) {
    parts.push('Child often replays narration; keep voiceover and avoid text-heavy prompts.');
  }
  if (insightTypes.includes('hint_dependent_success')) {
    parts.push('Child benefits from hints; use standard or heavier support and clear hint ladder.');
  }
  if (insightTypes.includes('retains_after_delay')) {
    parts.push('Retention after delay is good; review sessions are effective.');
  }
  parts.push(`Candidate skill: ${input.candidate_skill_name ?? input.candidate_skill_id ?? 'any'}.`);
  return parts.join(' ');
}

/**
 * Build a short "why this lesson" summary for parent/debug (real, from context + choices).
 */
export function buildWhyThisLessonSummary(
  context: LessonPlanningContext,
  skillName: string,
  supportLevel: SupportLevel,
  modality: Modality,
  generatedBy: 'openai' | 'deterministic'
): string {
  const parts: string[] = [];
  if (context.insight_summaries.length > 0) {
    const visual = context.insight_types.includes('workmat_visual_success') || context.insight_types.includes('prefers_narration_replay');
    const guided = context.insight_types.includes('guided_not_independent_gap');
    const hints = context.insight_types.includes('hint_dependent_success');
    if (visual && modality === 'visual') {
      parts.push('Visual, narrated lesson because recent signals show stronger success with visual modeling and replayed audio.');
    } else if (guided && (supportLevel === 'standard' || supportLevel === 'heavy')) {
      parts.push('Standard/heavy support because the learner does well with guidance but is still building independence.');
    } else if (hints && supportLevel !== 'minimal') {
      parts.push('Support level reflects benefit from hints on new concepts.');
    }
  }
  if (context.due_review_skill_ids.length > 0) {
    parts.push(`Scheduled review considered.`);
  }
  parts.push(`Skill: ${skillName}. Support: ${supportLevel}, modality: ${modality} (${generatedBy}).`);
  return parts.join(' ');
}
