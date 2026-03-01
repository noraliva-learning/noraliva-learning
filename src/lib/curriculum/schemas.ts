import { z } from 'zod';

/**
 * Zod schemas for curriculum entities, for validation and AI mode later.
 */

export const lessonSchema = z.object({
  id: z.string().uuid(),
  skill_id: z.string().uuid(),
  title: z.string().min(1),
  sort_order: z.number().int().min(0).default(0),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const exerciseSchema = z.object({
  id: z.string().uuid(),
  lesson_id: z.string().uuid(),
  prompt: z.string().min(1),
  sort_order: z.number().int().min(0).default(0),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type LessonSchema = z.infer<typeof lessonSchema>;
export type ExerciseSchema = z.infer<typeof exerciseSchema>;
