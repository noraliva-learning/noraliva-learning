import { describe, it, expect } from 'vitest';
import { deriveLearnerInsights } from './insight-engine';
import type { LearningSignals } from './learning-signals-schema';

describe('insight-engine', () => {
  it('returns empty when no signals', () => {
    const signals: LearningSignals = {
      hint_requests_total: 0,
      narration_replay_count: 0,
      scene_replay_count: 0,
      scene_outcomes: [],
    };
    expect(deriveLearnerInsights(signals)).toEqual([]);
  });

  it('derives fast_confident_correct when guided success with low latency', () => {
    const signals: LearningSignals = {
      response_latency_guided_ms: 3000,
      guided_success: true,
      hint_requests_total: 0,
      narration_replay_count: 0,
      scene_replay_count: 0,
      scene_outcomes: [],
    };
    const out = deriveLearnerInsights(signals);
    expect(out.some((i) => i.insight_type === 'fast_confident_correct')).toBe(true);
  });

  it('derives hint_dependent_success when hints used and success', () => {
    const signals: LearningSignals = {
      hint_requests_total: 2,
      guided_success: true,
      independent_success: true,
      narration_replay_count: 0,
      scene_replay_count: 0,
      scene_outcomes: [],
    };
    const out = deriveLearnerInsights(signals);
    expect(out.some((i) => i.insight_type === 'hint_dependent_success')).toBe(true);
  });

  it('derives guided_not_independent_gap when guided ok and independent not', () => {
    const signals: LearningSignals = {
      guided_success: true,
      independent_success: false,
      hint_requests_total: 0,
      narration_replay_count: 0,
      scene_replay_count: 0,
      scene_outcomes: [],
    };
    const out = deriveLearnerInsights(signals);
    expect(out.some((i) => i.insight_type === 'guided_not_independent_gap')).toBe(true);
  });

  it('derives workmat_visual_success when workmat used and valid', () => {
    const signals: LearningSignals = {
      workmat_used: true,
      workmat_validation_valid: true,
      hint_requests_total: 0,
      narration_replay_count: 0,
      scene_replay_count: 0,
      scene_outcomes: [],
    };
    const out = deriveLearnerInsights(signals);
    expect(out.some((i) => i.insight_type === 'workmat_visual_success')).toBe(true);
  });

  it('derives answer_switching when answer changed before submit', () => {
    const signals: LearningSignals = {
      answer_changed_before_submit_guided: true,
      hint_requests_total: 0,
      narration_replay_count: 0,
      scene_replay_count: 0,
      scene_outcomes: [],
    };
    const out = deriveLearnerInsights(signals);
    expect(out.some((i) => i.insight_type === 'answer_switching')).toBe(true);
  });

  it('derives rapid_guess_pattern when independent fail with very low latency', () => {
    const signals: LearningSignals = {
      response_latency_independent_ms: 1000,
      independent_success: false,
      hint_requests_total: 0,
      narration_replay_count: 0,
      scene_replay_count: 0,
      scene_outcomes: [],
    };
    const out = deriveLearnerInsights(signals);
    expect(out.some((i) => i.insight_type === 'rapid_guess_pattern')).toBe(true);
  });

  it('derives retains_after_delay when review_success', () => {
    const signals: LearningSignals = {
      review_success: true,
      hint_requests_total: 0,
      narration_replay_count: 0,
      scene_replay_count: 0,
      scene_outcomes: [],
    };
    const out = deriveLearnerInsights(signals);
    expect(out.some((i) => i.insight_type === 'retains_after_delay')).toBe(true);
  });

  it('each insight has summary_plain_english and evidence_summary', () => {
    const signals: LearningSignals = {
      guided_success: true,
      independent_success: false,
      hint_requests_total: 1,
      narration_replay_count: 0,
      scene_replay_count: 0,
      scene_outcomes: [],
    };
    const out = deriveLearnerInsights(signals);
    for (const i of out) {
      expect(i.summary_plain_english.length).toBeGreaterThan(0);
      expect(typeof i.evidence_summary).toBe('object');
    }
  });
});
