/**
 * Phase 4: Work Mat — schema for scene-level work mat config and persistence.
 */

import { z } from 'zod';

export const workmatModeSchema = z.enum(['structured_worksheet', 'free_sketch']);
export type WorkmatMode = z.infer<typeof workmatModeSchema>;

export const workmatToolSchema = z.enum([
  'pen',
  'highlighter',
  'eraser',
  'pointer',
  'line',
  'circle',
  'clear',
]);
export type WorkmatTool = z.infer<typeof workmatToolSchema>;

/** Ace modality hint for lesson planning. Phase 7: reading modalities. */
export const workmatModalitySchema = z.enum([
  'draw_groups',
  'trace_number',
  'circle_answer',
  'connect_matches',
  'underline_word_part',
  'build_array',
  'sketch_solution',
  'circle_first_sound',
  'connect_sound_letter',
  'phoneme_tiles_order',
  'build_word',
  'highlight_match',
  'trace_letter',
]);
export type WorkmatModality = z.infer<typeof workmatModalitySchema>;

export const validationTypeSchema = z.enum([
  'target_hit',
  'zone_overlap',
  'object_in_zone',
  'trace_completion',
  'marks_in_region',
  'connection_match',
]);
export type WorkmatValidationType = z.infer<typeof validationTypeSchema>;

export const targetZoneSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string().optional(),
  expected_value: z.union([z.string(), z.number()]).optional(),
});
export type TargetZone = z.infer<typeof targetZoneSchema>;

export const tracePathSchema = z.object({
  id: z.string().min(1),
  points: z.array(z.number()),
  stroke_width: z.number().optional(),
  dashed: z.boolean().optional(),
});
export type TracePath = z.infer<typeof tracePathSchema>;

export const draggableObjectSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['counter', 'block', 'text', 'image']),
  label: z.string().optional(),
  value: z.union([z.number(), z.string()]).optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  target_zone_id: z.string().optional(),
});
export type DraggableObject = z.infer<typeof draggableObjectSchema>;

export const expectedMarkSchema = z.object({
  zone_id: z.string().optional(),
  type: z.enum(['circle', 'underline', 'connect', 'stroke_count']).optional(),
  min_count: z.number().int().min(0).optional(),
  max_count: z.number().int().min(0).optional(),
});
export type ExpectedMark = z.infer<typeof expectedMarkSchema>;

export const demoOverlaySchema = z.object({
  type: z.enum(['trace_path', 'ghost_stroke', 'highlight_zone', 'placement_hint', 'connection_hint']),
  trace_path_id: z.string().optional(),
  zone_id: z.string().optional(),
  points: z.array(z.number()).optional(),
  from_id: z.string().optional(),
  to_id: z.string().optional(),
  duration_ms: z.number().optional(),
});
export type DemoOverlay = z.infer<typeof demoOverlaySchema>;

/** Scene-level work mat config (in lesson scene JSON) */
export const sceneWorkmatConfigSchema = z.object({
  workmat_enabled: z.boolean().default(false),
  workmat_mode: workmatModeSchema.default('free_sketch'),
  workmat_modality: workmatModalitySchema.optional(),
  background_asset: z.string().optional(),
  target_zones: z.array(targetZoneSchema).optional().default([]),
  trace_paths: z.array(tracePathSchema).optional().default([]),
  draggable_objects: z.array(draggableObjectSchema).optional().default([]),
  expected_marks: z.array(expectedMarkSchema).optional().default([]),
  validation_type: validationTypeSchema.optional(),
  demo_overlays: z.array(demoOverlaySchema).optional().default([]),
});
export type SceneWorkmatConfig = z.infer<typeof sceneWorkmatConfigSchema>;

/** Single stroke for persistence */
export const strokeSchema = z.object({
  tool: workmatToolSchema,
  points: z.array(z.number()),
  strokeWidth: z.number(),
  color: z.string(),
  opacity: z.number().optional(),
});
export type Stroke = z.infer<typeof strokeSchema>;

/** Placed object position (for draggables) */
export const placedObjectSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
});
export type PlacedObject = z.infer<typeof placedObjectSchema>;

/** Connection between two objects (for line tool) */
export const connectionSchema = z.object({
  fromId: z.string(),
  toId: z.string(),
  points: z.array(z.number()),
});
export type Connection = z.infer<typeof connectionSchema>;

/** Full work mat state for persistence */
export const workmatStateSchema = z.object({
  strokes: z.array(strokeSchema).default([]),
  placed_objects: z.array(placedObjectSchema).default([]),
  connections: z.array(connectionSchema).default([]),
  completed_at: z.string().datetime().optional(),
});
export type WorkmatState = z.infer<typeof workmatStateSchema>;

/** Validation result summary */
export const workmatValidationResultSchema = z.object({
  valid: z.boolean(),
  validation_type: validationTypeSchema.optional(),
  trace_completion_percent: z.number().optional(),
  zones_hit: z.array(z.string()).optional(),
  objects_in_correct_zone: z.number().optional(),
  marks_in_region: z.number().optional(),
  connections_matched: z.boolean().optional(),
});
export type WorkmatValidationResult = z.infer<typeof workmatValidationResultSchema>;
