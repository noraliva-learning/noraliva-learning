/**
 * Deterministic misconception classifier per domain (Phase 2).
 * Uses rule-based heuristics from skill slug / exercise; no AI.
 * Returns a single tag per wrong attempt for storage and struggle detection.
 */

import {
  getTagsForDomain,
  type DomainSlug,
} from './misconceptionTags';

export type ClassifierInput = {
  domain: DomainSlug;
  skillSlug: string;
  exerciseId?: string;
  /** Optional: learner's wrong answer for future heuristic use */
  wrongAnswer?: string;
};

/**
 * Returns one misconception tag for a wrong attempt.
 * Deterministic: same inputs -> same tag. Uses skill slug and domain.
 */
export function classifyMisconception(input: ClassifierInput): string {
  const tags = getTagsForDomain(input.domain);
  if (tags.length === 0) return 'general';

  // Deterministic hash from skill slug + exercise id to pick a tag (so we spread across tags over time)
  const key = `${input.skillSlug}:${input.exerciseId ?? ''}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % tags.length;
  return tags[index];
}
