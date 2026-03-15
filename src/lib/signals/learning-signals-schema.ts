/**
 * Phase 5: Learning signal layer — structured capture schema.
 */

import { z } from 'zod';

/** Per-scene outcome (extended for signals) */
export const sceneSignalOutcomeSchema = z.object({
  scene_id: z.string().min(1),
  scene_type: z.string().min(1),
  success: z.boolean().optional(),
  hints_used: z.number().int().min(0).optional().default(0),
  response_time_ms: z.number().int().min(0).optional(),
  answer_changed_before_submit: z.boolean().optional(),
  narration_replay_count: z.number().int().min(0).optional().default(0),
});

/** Lesson-level learning signals (client-reported + server-inferred) */
export const learningSignalsSchema = z.object({
  response_latency_guided_ms: z.number().int().min(0).optional(),
  response_latency_independent_ms: z.number().int().min(0).optional(),
  hint_requests_total: z.number().int().min(0).optional().default(0),
  answer_changed_before_submit_guided: z.boolean().optional(),
  answer_changed_before_submit_independent: z.boolean().optional(),
  guided_success: z.boolean().optional(),
  independent_success: z.boolean().optional(),
  workmat_used: z.boolean().optional(),
  workmat_validation_type: z.string().optional(),
  workmat_validation_valid: z.boolean().optional(),
  narration_replay_count: z.number().int().min(0).optional().default(0),
  scene_replay_count: z.number().int().min(0).optional().default(0),
  abandonment_signal: z.boolean().optional(),
  scene_outcomes: z.array(sceneSignalOutcomeSchema).optional().default([]),
  /** Server-only: true if this lesson was a scheduled review */
  review_success: z.boolean().optional(),
  /** Server-only: first time through this skill in this run */
  first_pass_success: z.boolean().optional(),
});

export type LearningSignals = z.infer<typeof learningSignalsSchema>;
export type SceneSignalOutcome = z.infer<typeof sceneSignalOutcomeSchema>;
