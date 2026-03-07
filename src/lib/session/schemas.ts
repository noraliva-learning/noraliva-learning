import { z } from 'zod';

export const sessionPathSchema = z.enum(['level_up', 'review']);
export type SessionPathType = z.infer<typeof sessionPathSchema>;

export const startSessionBodySchema = z.object({
  domain: z.string().min(1).max(50),
});
export type StartSessionBody = z.infer<typeof startSessionBodySchema>;

export const startSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  pathChoices: z.array(
    z.object({
      id: sessionPathSchema,
      label: z.string(),
      description: z.string().optional(),
    })
  ),
  preview: z.object({
    minQuestions: z.number().int().min(1),
    maxQuestions: z.number().int().min(1),
  }),
});
export type StartSessionResponse = z.infer<typeof startSessionResponseSchema>;

export const generatePlanBodySchema = z.object({
  sessionId: z.string().uuid(),
  path: sessionPathSchema,
});
export type GeneratePlanBody = z.infer<typeof generatePlanBodySchema>;

export const generatePlanResponseSchema = z.object({
  exerciseIds: z.array(z.string().uuid()),
  planLength: z.number().int().min(0).optional(),
});
export type GeneratePlanResponse = z.infer<typeof generatePlanResponseSchema>;

export const submitAttemptBodySchema = z.object({
  sessionId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  correct: z.boolean(),
  learnerAnswer: z.string().optional(),
  masteryDelta: z.number().min(-0.2).max(0.2).optional(),
  misconceptionTag: z.string().max(100).optional(),
});
export type SubmitAttemptBody = z.infer<typeof submitAttemptBodySchema>;

export const submitAttemptResponseSchema = z.object({
  nextStep: z.enum(['next', 'micro_lesson', 'end']),
  masteryLevel: z.number().int().min(0).max(5),
  exerciseId: z.string().uuid().optional(),
  prompt: z.string().optional(),
  microLesson: z.string().optional(),
  dueReviewsCount: z.number().int().min(0).optional(),
  index: z.number().int().min(0).optional(),
  total: z.number().int().min(0).optional(),
});
export type SubmitAttemptResponse = z.infer<typeof submitAttemptResponseSchema>;

export const getNextQuerySchema = z.object({
  sessionId: z.string().uuid(),
});
export type GetNextQuery = z.infer<typeof getNextQuerySchema>;

export const getNextResponseSchema = z.object({
  exerciseId: z.string().uuid(),
  prompt: z.string(),
  index: z.number().int().min(0),
  total: z.number().int().min(0),
});
export type GetNextResponse = z.infer<typeof getNextResponseSchema>;
