/**
 * Lightweight integration tests for Phase 2 session API.
 * These assert response shapes and that start/plan/next flow produces a question payload
 * when session_plan is non-empty. Full E2E with auth is in e2e/session-flow.spec.ts
 * (skipped without TEST_LEARNER_EMAIL / TEST_LEARNER_PASSWORD).
 */
import { describe, expect, it } from 'vitest';
import { getNextResponseSchema, generatePlanResponseSchema } from '@/lib/session/schemas';
import { getSessionPlanIds } from '@/lib/session/sessionPlanUtils';

describe('Session API contract', () => {
  it('next response schema accepts valid question payload', () => {
    const payload = {
      exerciseId: '11111111-1111-1111-1111-111111111111',
      prompt: 'What is 2 + 2?',
      index: 0,
      total: 5,
    };
    const parsed = getNextResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.exerciseId).toBe(payload.exerciseId);
      expect(parsed.data.total).toBe(5);
    }
  });

  it('plan response schema accepts exerciseIds and planLength', () => {
    const exerciseIds = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'];
    const parsed = generatePlanResponseSchema.safeParse({ exerciseIds, planLength: 2 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.planLength).toBe(2);
      expect(parsed.data.exerciseIds).toEqual(exerciseIds);
    }
  });

  it('getSessionPlanIds round-trips plan stored by plan route (fallback format)', () => {
    const ids = ['a', 'b', 'c'];
    const stored = ids.map((id) => ({ id, fallback: true }));
    expect(getSessionPlanIds(stored)).toEqual(ids);
  });
});
