import { describe, it, expect } from 'vitest';
import { learningSignalsSchema } from './learning-signals-schema';

describe('learning-signals-schema', () => {
  it('parses minimal signals', () => {
    const s = learningSignalsSchema.parse({});
    expect(s.hint_requests_total).toBe(0);
    expect(s.narration_replay_count).toBe(0);
    expect(s.scene_replay_count).toBe(0);
    expect(s.scene_outcomes).toEqual([]);
  });

  it('parses full lesson signals', () => {
    const s = learningSignalsSchema.parse({
      response_latency_guided_ms: 8000,
      response_latency_independent_ms: 12000,
      hint_requests_total: 2,
      answer_changed_before_submit_guided: true,
      guided_success: true,
      independent_success: false,
      workmat_used: true,
      workmat_validation_valid: true,
      narration_replay_count: 3,
      scene_outcomes: [
        { scene_id: 'g1', scene_type: 'guided_try', success: true, hints_used: 1, response_time_ms: 5000 },
      ],
    });
    expect(s.response_latency_guided_ms).toBe(8000);
    expect(s.guided_success).toBe(true);
    expect(s.independent_success).toBe(false);
    expect(s.workmat_used).toBe(true);
    expect(s.narration_replay_count).toBe(3);
    expect(s.scene_outcomes).toHaveLength(1);
    expect(s.scene_outcomes![0].scene_id).toBe('g1');
  });
});
