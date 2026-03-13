/**
 * Learner-specific theme configuration.
 * Used for Elle (magical clouds/rainbows/unicorns) and Liv (dinosaur explorer).
 * All visual tokens are applied via CSS variables in learner-theme.css.
 */

export type LearnerSlug = "liv" | "elle";

export const LEARNER_SLUGS: LearnerSlug[] = ["liv", "elle"];

export function isLearnerSlug(s: string | undefined): s is LearnerSlug {
  return s === "liv" || s === "elle";
}

/** Display name for learner (for UI only). */
export function getLearnerDisplayName(slug: LearnerSlug): string {
  return slug === "liv" ? "Liv" : "Elle";
}

/** Whether this learner gets automatic question read-aloud (Elle cannot read yet). */
export function shouldAutoReadAloud(slug: LearnerSlug): boolean {
  return slug === "elle";
}
