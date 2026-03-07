import { describe, expect, it } from 'vitest';
import {
  updateMasteryFromCounts,
  scheduleNextReview,
  edgeOfLearningScore,
  isPromoted,
  isStruggling,
} from './masteryEngine';

describe('updateMasteryFromCounts', () => {
  it('starts from prior mean 0.3 with zero attempts', () => {
    const r = updateMasteryFromCounts(0, 0, true);
    // Prior Beta(0.6, 1.4); after 1 success: (0.6+1)/(0.6+1.4+1) = 1.6/3
    expect(r.mastery_probability).toBeCloseTo(1.6 / 3, 5);
    expect(r.attempts_count).toBe(1);
    expect(r.confidence_score).toBe(3);
  });

  it('increases mastery after correct attempt', () => {
    const r = updateMasteryFromCounts(5, 4, true);
    // 5th correct: (0.6+5)/(0.6+1.4+6) = 5.6/8 = 0.7 (prior pulls below raw 5/6)
    expect(r.mastery_probability).toBeGreaterThan(0.5);
    expect(r.attempts_count).toBe(6);
  });

  it('decreases mastery after incorrect attempt', () => {
    const r = updateMasteryFromCounts(5, 5, false);
    expect(r.mastery_probability).toBeLessThan(1);
    expect(r.attempts_count).toBe(6);
  });

  it('confidence grows with attempts', () => {
    const r1 = updateMasteryFromCounts(0, 0, true);
    const r2 = updateMasteryFromCounts(10, 8, true);
    expect(r2.confidence_score).toBeGreaterThan(r1.confidence_score);
  });
});

describe('scheduleNextReview', () => {
  const base = new Date('2025-03-01T12:00:00Z');

  it('schedules short interval after incorrect', () => {
    const next = scheduleNextReview(false, 0.5, base);
    expect(next.getTime() - base.getTime()).toBe(10 * 60 * 1000);
  });

  it('schedules 7–14 days (short-term) after correct when mastery < 0.85', () => {
    const next = scheduleNextReview(true, 0.5, base);
    const days = (next.getTime() - base.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThanOrEqual(7);
    expect(days).toBeLessThanOrEqual(14);
  });

  it('schedules 30–90 days (long-term) after correct when mastery >= 0.85', () => {
    const next = scheduleNextReview(true, 0.9, base);
    const days = (next.getTime() - base.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThanOrEqual(30);
    expect(days).toBeLessThanOrEqual(90);
  });

  it('schedules ~7 days at low mastery', () => {
    const next = scheduleNextReview(true, 0.5, base);
    expect(next.getDate()).toBe(8);
  });
});

describe('edgeOfLearningScore', () => {
  it('returns higher score for mastery near 0.55', () => {
    const mid = edgeOfLearningScore(0.55, 10);
    const low = edgeOfLearningScore(0.2, 10);
    const high = edgeOfLearningScore(0.95, 10);
    expect(mid).toBeGreaterThan(low);
    expect(mid).toBeGreaterThan(high);
  });

  it('returns value in [0, 1] range', () => {
    expect(edgeOfLearningScore(0.5, 5)).toBeGreaterThanOrEqual(0);
    expect(edgeOfLearningScore(0.5, 5)).toBeLessThanOrEqual(1);
  });

  it('handles zero confidence', () => {
    expect(edgeOfLearningScore(0.5, 0)).toBe(0.5);
  });
});

describe('isPromoted', () => {
  it('requires mastery >= 0.85, confidence >= 5, spaced_check_count >= 2', () => {
    expect(isPromoted({ mastery_probability: 0.9, confidence_score: 10, spaced_check_count: 2 })).toBe(true);
    expect(isPromoted({ mastery_probability: 0.84, confidence_score: 10, spaced_check_count: 2 })).toBe(false);
    expect(isPromoted({ mastery_probability: 0.9, confidence_score: 4, spaced_check_count: 2 })).toBe(false);
    expect(isPromoted({ mastery_probability: 0.9, confidence_score: 10, spaced_check_count: 1 })).toBe(false);
  });
});

describe('isStruggling', () => {
  it('triggers when accuracy < 0.60', () => {
    expect(isStruggling({ accuracy: 0.5, recentMisconceptionCounts: [] })).toBe(true);
    expect(isStruggling({ accuracy: 0.6, recentMisconceptionCounts: [] })).toBe(false);
  });
  it('triggers when same misconception >= 3 in recent window', () => {
    expect(isStruggling({ accuracy: 0.7, recentMisconceptionCounts: [{ tag: 'place_value', count: 3 }] })).toBe(true);
    expect(isStruggling({ accuracy: 0.7, recentMisconceptionCounts: [{ tag: 'place_value', count: 2 }] })).toBe(false);
  });
});
