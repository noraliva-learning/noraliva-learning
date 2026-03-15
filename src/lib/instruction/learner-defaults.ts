/**
 * Phase 3: Liv / Elle differentiation — configurable learner profile defaults.
 * Not hardcoded forever; can be moved to DB or config later.
 */

import type { LearnerInstructionDefaults } from './engine-types';
import type { LearnerSlug } from './engine-types';

/** Liv: slightly more challenge, more abstraction, faster progression when mastery clear, transfer-oriented */
export const LIV_DEFAULTS: LearnerInstructionDefaults = {
  support_level: 'light',
  modality: 'mixed',
  prefer_shorter_chunks: false,
  prefer_more_visual: false,
  prefer_more_read_aloud: false,
  progression_speed: 'faster',
  transfer_prompts: true,
};

/** Elle: less text, more visual modeling, more read-aloud, shorter chunks, more guided support */
export const ELLE_DEFAULTS: LearnerInstructionDefaults = {
  support_level: 'standard',
  modality: 'visual',
  prefer_shorter_chunks: true,
  prefer_more_visual: true,
  prefer_more_read_aloud: true,
  progression_speed: 'standard',
  transfer_prompts: false,
};

export function getLearnerInstructionDefaults(slug: LearnerSlug): LearnerInstructionDefaults {
  return slug === 'liv' ? { ...LIV_DEFAULTS } : { ...ELLE_DEFAULTS };
}
