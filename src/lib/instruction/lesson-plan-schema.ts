/**
 * Phase 3: Ace Instruction Engine — Lesson Plan output schema.
 * Inputs are typed in the engine; outputs are validated here.
 */

import { z } from 'zod';
import { sceneSequenceSchema, type SceneSequence } from './scene-schema';

export const supportLevelSchema = z.enum(['minimal', 'light', 'standard', 'heavy', 'full_guided']);
export type SupportLevel = z.infer<typeof supportLevelSchema>;

export const modalitySchema = z.enum(['visual', 'verbal', 'kinesthetic', 'mixed']);
export type Modality = z.infer<typeof modalitySchema>;

export const promotionDecisionSchema = z.enum(['advance', 'hold', 'review']);
export type PromotionDecision = z.infer<typeof promotionDecisionSchema>;

export const lessonPlanMetadataSchema = z.object({
  target_skill: z.string().min(1),
  target_skill_id: z.string().uuid().optional(),
  why_this_skill_next: z.string().optional(),
  learner_support_level: supportLevelSchema.default('standard'),
  modality: modalitySchema.default('mixed'),
  scene_sequence: sceneSequenceSchema,
  hint_ladder: z.array(z.string()).optional().default([]),
  promotion_criteria: z.object({
    correct_independent_try: z.boolean().optional(),
    min_mastery_delta: z.number().optional(),
    require_spaced_check: z.boolean().optional(),
  }).optional(),
  promotion_decision: promotionDecisionSchema.optional(),
  fallback_retry_plan: z.object({
    retry_scenes: z.array(z.string()).optional(),
    alternative_skill_id: z.string().uuid().optional(),
  }).optional(),
  generated_by: z.enum(['openai', 'deterministic']).optional(),
  version: z.string().optional().default('1.0'),
});

export type LessonPlanMetadata = z.infer<typeof lessonPlanMetadataSchema>;

/** Full lesson plan as stored and returned by the engine */
/** Phase 5B: Traceability — was this plan influenced by learner insights? */
export const acePlanningMetadataSchema = z.object({
  planning_context_version: z.string().optional().default('1.0'),
  insight_types_considered: z.array(z.string()).optional().default([]),
  support_level_chosen: supportLevelSchema.optional(),
  modality_chosen: modalitySchema.optional(),
  influenced_by_learner_insights: z.boolean().optional().default(false),
  why_this_lesson_summary: z.string().optional(),
});
export type AcePlanningMetadata = z.infer<typeof acePlanningMetadataSchema>;

export const lessonPlanSchema = z.object({
  id: z.string().uuid().optional(),
  learner_id: z.string().uuid(),
  domain: z.string().min(1),
  skill: z.string().min(1),
  skill_id: z.string().uuid().optional(),
  why_next: z.string().optional(),
  support_level: supportLevelSchema,
  modality: modalitySchema,
  scene_sequence: sceneSequenceSchema,
  hint_ladder: z.array(z.string()).default([]),
  promotion_criteria: z.object({
    correct_independent_try: z.boolean().optional(),
    min_mastery_delta: z.number().optional(),
    require_spaced_check: z.boolean().optional(),
  }).optional(),
  promotion_decision: promotionDecisionSchema.optional(),
  fallback_retry_plan: z.object({
    retry_scenes: z.array(z.string()).optional(),
    alternative_skill_id: z.string().uuid().optional(),
  }).optional(),
  generated_by: z.enum(['openai', 'deterministic']).default('deterministic'),
  version: z.string().default('1.0'),
  /** Phase 5B: traceability and parent-facing "why this lesson" */
  ace_planning_metadata: acePlanningMetadataSchema.optional(),
});

export type LessonPlan = z.infer<typeof lessonPlanSchema>;

export function validateLessonPlan(data: unknown): LessonPlan {
  return lessonPlanSchema.parse(data);
}
