import { describe, it, expect } from 'vitest';
import { utcDateString, computeDailyJustMet } from './utcDate';

describe('utcDateString', () => {
  it('returns YYYY-MM-DD for a fixed UTC instant', () => {
    expect(utcDateString(new Date('2026-06-15T12:00:00.000Z'))).toBe('2026-06-15');
  });
});

describe('computeDailyJustMet', () => {
  it('true only when crossing to met', () => {
    expect(computeDailyJustMet(false, true)).toBe(true);
    expect(computeDailyJustMet(true, true)).toBe(false);
    expect(computeDailyJustMet(false, false)).toBe(false);
  });
});
