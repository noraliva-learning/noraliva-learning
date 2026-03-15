/**
 * Phase 3B: Promotion / hold / review / reteach — configurable decision rules.
 */

import type { PromotionDecision } from './completion-schemas';

export type PromotionRuleConfig = {
  /** Advance: mastery >= this */
  advanceMasteryMin: number;
  /** Advance: independent try must be success */
  advanceRequireIndependentSuccess: boolean;
  /** Advance: max hints considered "low" (above = hold) */
  advanceMaxHints: number;
  /** Hold: mastery in [holdMasteryMin, advanceMasteryMin) */
  holdMasteryMin: number;
  /** Reteach: independent try failed or mastery very low */
  reteachMasteryMax: number;
  /** Reteach: or repeated misconception count >= this */
  reteachMisconceptionCountThreshold: number;
  /** Review: when we schedule review (e.g. after advance or hold) */
  reviewShortTermDays: number;
  reviewLongTermDays: number;
};

export const DEFAULT_PROMOTION_CONFIG: PromotionRuleConfig = {
  advanceMasteryMin: 0.75,
  advanceRequireIndependentSuccess: true,
  advanceMaxHints: 2,
  holdMasteryMin: 0.5,
  reteachMasteryMax: 0.45,
  reteachMisconceptionCountThreshold: 2,
  reviewShortTermDays: 7,
  reviewLongTermDays: 30,
};

export type PromotionRuleInput = {
  guidedTrySuccess: boolean;
  independentTrySuccess: boolean;
  hintUsageCount: number;
  misconceptionSignalsCount: number;
  masteryBefore: number;
  confidenceBefore: number;
};

/**
 * Returns promotion_decision: advance | hold | review | reteach.
 * - advance: mastery high, independent success, low hints
 * - hold: partial understanding, not yet secure
 * - review: previously learned, show decay (mastery dropped) — treat as "review" so we schedule
 * - reteach: failed independent or many misconceptions
 */
export function computePromotionDecision(
  input: PromotionRuleInput,
  config: PromotionRuleConfig = DEFAULT_PROMOTION_CONFIG
): PromotionDecision {
  const {
    advanceMasteryMin,
    advanceRequireIndependentSuccess,
    advanceMaxHints,
    holdMasteryMin,
    reteachMasteryMax,
    reteachMisconceptionCountThreshold,
  } = config;

  if (
    !input.independentTrySuccess ||
    input.masteryBefore <= reteachMasteryMax ||
    input.misconceptionSignalsCount >= reteachMisconceptionCountThreshold
  ) {
    return 'reteach';
  }

  if (
    input.masteryBefore >= advanceMasteryMin &&
    (!advanceRequireIndependentSuccess || input.independentTrySuccess) &&
    input.hintUsageCount <= advanceMaxHints
  ) {
    return 'advance';
  }

  if (input.masteryBefore >= holdMasteryMin && input.masteryBefore < advanceMasteryMin) {
    return 'hold';
  }

  return 'review';
}
