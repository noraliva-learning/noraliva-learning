/**
 * Phase 3B: Lesson completion — input and output Zod schemas.
 * Phase 5: Learning signals on completion input.
 */

import { z } from 'zod';
import { learningSignalsSchema } from '@/lib/signals/learning-signals-schema';

/** Client-reported scene outcome (e.g. guided_try passed, independent_try passed, hints used) */
export const sceneOutcomeSchema = z.object({
  scene_id: z.string().min(1),
  scene_type: z.string().min(1),
  success: z.boolean().optional(),
  hints_used: z.number().int().min(0).optional().default(0),
  response_time_ms: z.number().int().min(0).optional(),
});

/** Work Mat output (Phase 4) */
export const workmatOutputSchema = z.object({
  workmat_used: z.boolean(),
  state: z.object({
    strokes: z.array(z.unknown()).optional(),
    placed_objects: z.array(z.unknown()).optional(),
    connections: z.array(z.unknown()).optional(),
  }).optional(),
  validation_result: z.object({
    valid: z.boolean(),
    validation_type: z.string().optional(),
    trace_completion_percent: z.number().optional(),
    zones_hit: z.array(z.string()).optional(),
    marks_in_region: z.number().optional(),
  }).optional(),
});

/** Learner responses / outcomes sent when lesson is completed */
export const lessonCompletionInputSchema = z.object({
  episode_id: z.string().uuid(),
  guided_try_success: z.boolean(),
  independent_try_success: z.boolean(),
  hint_usage_count: z.number().int().min(0).default(0),
  scene_outcomes: z.array(sceneOutcomeSchema).optional().default([]),
  misconception_signals: z.array(z.string()).optional().default([]),
  completed_at: z.string().datetime().optional(),
  workmat_output: workmatOutputSchema.optional(),
  learning_signals: learningSignalsSchema.optional(),
});

export type LessonCompletionInput = z.infer<typeof lessonCompletionInputSchema>;
export type SceneOutcome = z.infer<typeof sceneOutcomeSchema>;

/** Promotion decision including reteach (Phase 3B) */
export const promotionDecisionSchema = z.enum(['advance', 'hold', 'review', 'reteach']);
export type PromotionDecision = z.infer<typeof promotionDecisionSchema>;

/** Lesson outcome summary from evaluator */
export const lessonOutcomeSummarySchema = z.object({
  promotion_decision: promotionDecisionSchema,
  mastery_delta: z.number(),
  confidence_delta: z.number(),
  /** For persistence: new values after this lesson */
  new_mastery_probability: z.number(),
  new_confidence_score: z.number(),
  new_attempts_count: z.number().int().min(0),
  next_review_at: z.string().datetime().optional(),
  misconception_updates: z.array(z.object({
    skill_id: z.string().uuid().optional(),
    tag: z.string(),
    action: z.enum(['record', 'clear']),
  })).optional().default([]),
  review_recommendation: z.object({
    schedule_review: z.boolean(),
    next_review_at: z.string().datetime().optional(),
    reason: z.string().optional(),
  }).optional(),
  next_skill_candidate: z.object({
    skill_id: z.string().uuid(),
    skill_name: z.string(),
    reason: z.enum(['advance', 'reinforce', 'bridge_prerequisite', 'scheduled_review']),
    why: z.string().optional(),
  }).optional(),
});

export type LessonOutcomeSummary = z.infer<typeof lessonOutcomeSummarySchema>;

/** Mastery state snapshot (before/after) for audit */
export const masterySnapshotSchema = z.object({
  skill_id: z.string().uuid(),
  mastery_probability: z.number(),
  confidence_score: z.number(),
  attempts_count: z.number().int().min(0),
  spaced_check_count: z.number().int().min(0).optional(),
  next_review_at: z.string().datetime().nullable().optional(),
});

export type MasterySnapshot = z.infer<typeof masterySnapshotSchema>;
