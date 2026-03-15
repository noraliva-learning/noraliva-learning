/**
 * Phase 3: Lesson Scene JSON Schema.
 * Phase 4: Optional workmat config on scenes.
 */

import { z } from 'zod';
import { sceneWorkmatConfigSchema } from '@/lib/workmat/workmat-schema';

export const sceneTypeSchema = z.enum([
  'focus_scene',
  'visual_teaching_sequence',
  'concept_card',
  'worked_example',
  'manipulative',
  'guided_try',
  'independent_try',
  'hint_step',
  'celebration',
]);
export type SceneType = z.infer<typeof sceneTypeSchema>;

/** Phase 6: Animation kinds for visual teaching steps. Phase 7: reading animations. */
export const visualTeachingStepAnimationSchema = z.enum([
  'object_appear',
  'grouping',
  'highlighting',
  'transformation',
  'counting',
  'rotation',
  'structure_reveal',
  'groups_appear',
  'dots_fill_groups',
  'highlight_rows',
  'rotate_to_array',
  'combine_groups',
  'take_away',
  'number_line_jump',
  'sound_to_letter_reveal',
  'blend_sound_sequence',
  'stretch_and_merge_word',
  'highlight_beginning_sound',
  'segment_into_phonemes',
]);
export type VisualTeachingStepAnimation = z.infer<typeof visualTeachingStepAnimationSchema>;

/** Phase 6: Single step in a visual teaching sequence */
export const visualTeachingStepSchema = z.object({
  animation: visualTeachingStepAnimationSchema,
  voiceover_text: z.string().optional(),
  duration_ms: z.number().int().min(0).optional(),
});
export type VisualTeachingStep = z.infer<typeof visualTeachingStepSchema>;

export const animationTypeSchema = z.enum([
  'none',
  'fade_in',
  'slide_up',
  'slide_left',
  'scale_in',
  'stagger',
  'highlight_pulse',
  'count_in',
]);
export type AnimationType = z.infer<typeof animationTypeSchema>;

export const interactionTypeSchema = z.enum([
  'none',
  'tap_continue',
  'tap_object',
  'drag_drop',
  'type_answer',
  'select_choice',
  'count_tap',
]);
export type InteractionType = z.infer<typeof interactionTypeSchema>;

export const validationRuleSchema = z.enum([
  'exact_match',
  'numeric_match',
  'numeric_range',
  'set_match',
  'custom',
]);
export type ValidationRule = z.infer<typeof validationRuleSchema>;

const sceneObjectSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['text', 'image', 'counter', 'group', 'number_line', 'block']).optional(),
  label: z.string().optional(),
  value: z.union([z.number(), z.string()]).optional(),
  position: z.tuple([z.number(), z.number()]).optional(),
  highlight: z.boolean().optional(),
});

/** Base fields shared by all scene types */
const sceneBaseSchema = z.object({
  id: z.string().min(1),
  type: sceneTypeSchema,
  domain: z.string().min(1).optional(),
  skill: z.string().min(1).optional(),
  skill_id: z.string().uuid().optional(),
  display_text: z.string().optional(),
  voiceover_text: z.string().optional(),
  animation_type: animationTypeSchema.optional().default('fade_in'),
  objects: z.array(sceneObjectSchema).optional(),
  interaction_type: interactionTypeSchema.optional().default('none'),
  workmat: sceneWorkmatConfigSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** Scenes that can have expected answer + validation */
const answerableSceneSchema = sceneBaseSchema.extend({
  expected_answer: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]).optional(),
  validation_rule: validationRuleSchema.optional(),
  hints: z.array(z.string()).optional().default([]),
});

export const focusSceneSchema = sceneBaseSchema.extend({
  type: z.literal('focus_scene'),
});
export type FocusScene = z.infer<typeof focusSceneSchema>;

/** Phase 6: Visual teaching sequence — animated steps before practice */
export const visualTeachingSequenceSchema = sceneBaseSchema.extend({
  type: z.literal('visual_teaching_sequence'),
  steps: z.array(visualTeachingStepSchema).min(1),
  voiceover_text: z.string().optional(),
});
export type VisualTeachingSequenceScene = z.infer<typeof visualTeachingSequenceSchema>;

export const conceptCardSchema = sceneBaseSchema.extend({
  type: z.literal('concept_card'),
});
export type ConceptCardScene = z.infer<typeof conceptCardSchema>;

export const workedExampleSchema = sceneBaseSchema.extend({
  type: z.literal('worked_example'),
  steps: z.array(z.object({ text: z.string(), voiceover: z.string().optional() })).optional(),
});
export type WorkedExampleScene = z.infer<typeof workedExampleSchema>;

export const manipulativeSchema = sceneBaseSchema.extend({
  type: z.literal('manipulative'),
  objects: z.array(sceneObjectSchema).optional(),
});
export type ManipulativeScene = z.infer<typeof manipulativeSchema>;

export const guidedTrySchema = answerableSceneSchema.extend({
  type: z.literal('guided_try'),
});
export type GuidedTryScene = z.infer<typeof guidedTrySchema>;

export const independentTrySchema = answerableSceneSchema.extend({
  type: z.literal('independent_try'),
});
export type IndependentTryScene = z.infer<typeof independentTrySchema>;

export const hintStepSchema = sceneBaseSchema.extend({
  type: z.literal('hint_step'),
  hint_index: z.number().int().min(0).optional(),
  hint_text: z.string().optional(),
});
export type HintStepScene = z.infer<typeof hintStepSchema>;

export const celebrationSchema = sceneBaseSchema.extend({
  type: z.literal('celebration'),
  xp: z.number().int().min(0).optional(),
});
export type CelebrationScene = z.infer<typeof celebrationSchema>;

/** Discriminated union for any scene */
export const lessonSceneSchema = z.discriminatedUnion('type', [
  focusSceneSchema,
  visualTeachingSequenceSchema,
  conceptCardSchema,
  workedExampleSchema,
  manipulativeSchema,
  guidedTrySchema,
  independentTrySchema,
  hintStepSchema,
  celebrationSchema,
]);

export type LessonScene = z.infer<typeof lessonSceneSchema>;

/** Ordered scene sequence for one teaching episode */
export const sceneSequenceSchema = z.array(lessonSceneSchema);
export type SceneSequence = z.infer<typeof sceneSequenceSchema>;

/** Teaching episode flow (canonical order). Phase 6: visual_teaching_sequence before concept_card. */
export const TEACHING_EPISODE_FLOW: SceneType[] = [
  'focus_scene',
  'visual_teaching_sequence',
  'concept_card',
  'worked_example',
  'manipulative',
  'guided_try',
  'independent_try',
  'hint_step',
  'celebration',
];

export function validateScene(data: unknown): LessonScene {
  return lessonSceneSchema.parse(data);
}

export function validateSceneSequence(data: unknown): SceneSequence {
  return sceneSequenceSchema.parse(data);
}
