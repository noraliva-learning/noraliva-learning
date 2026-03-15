import { describe, it, expect } from 'vitest';
import { computePromotionDecision, DEFAULT_PROMOTION_CONFIG } from './promotion-rules';

describe('promotion-rules', () => {
  it('returns reteach when independent try failed', () => {
    const decision = computePromotionDecision({
      guidedTrySuccess: true,
      independentTrySuccess: false,
      hintUsageCount: 0,
      misconceptionSignalsCount: 0,
      masteryBefore: 0.8,
      confidenceBefore: 10,
    });
    expect(decision).toBe('reteach');
  });

  it('returns reteach when many misconceptions', () => {
    const decision = computePromotionDecision({
      guidedTrySuccess: true,
      independentTrySuccess: true,
      hintUsageCount: 0,
      misconceptionSignalsCount: 2,
      masteryBefore: 0.5,
      confidenceBefore: 5,
    });
    expect(decision).toBe('reteach');
  });

  it('returns advance when mastery high, independent success, low hints', () => {
    const decision = computePromotionDecision({
      guidedTrySuccess: true,
      independentTrySuccess: true,
      hintUsageCount: 1,
      misconceptionSignalsCount: 0,
      masteryBefore: 0.8,
      confidenceBefore: 8,
    });
    expect(decision).toBe('advance');
  });

  it('returns hold when mastery in hold range', () => {
    const decision = computePromotionDecision({
      guidedTrySuccess: true,
      independentTrySuccess: true,
      hintUsageCount: 0,
      misconceptionSignalsCount: 0,
      masteryBefore: 0.6,
      confidenceBefore: 5,
    });
    expect(decision).toBe('hold');
  });

  it('returns review when mastery above reteach max but below hold min', () => {
    const decision = computePromotionDecision({
      guidedTrySuccess: true,
      independentTrySuccess: true,
      hintUsageCount: 0,
      misconceptionSignalsCount: 0,
      masteryBefore: 0.48,
      confidenceBefore: 4,
    });
    expect(decision).toBe('review');
  });
});
