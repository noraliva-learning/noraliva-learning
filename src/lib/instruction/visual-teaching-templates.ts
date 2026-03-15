/**
 * Phase 6: Reusable animation templates for visual teaching sequences.
 * Phase 7: Reading templates (sound_to_letter_reveal, blend_sound_sequence, etc.).
 */

import type { VisualTeachingStep } from './scene-schema';

export type VisualTeachingTemplateId =
  | 'equal_groups'
  | 'arrays'
  | 'counting_groups'
  | 'number_line_jump'
  | 'addition_combine'
  | 'subtraction_take_away'
  | 'sound_to_letter_reveal'
  | 'blend_sound_sequence'
  | 'stretch_and_merge_word'
  | 'highlight_beginning_sound'
  | 'segment_into_phonemes';

export type VisualTeachingTemplate = {
  id: VisualTeachingTemplateId;
  /** Default voiceover for the whole sequence */
  default_voiceover: string;
  steps: VisualTeachingStep[];
};

const STEP = (animation: VisualTeachingStep['animation'], voiceover?: string, duration_ms?: number): VisualTeachingStep =>
  duration_ms !== undefined
    ? { animation, voiceover_text: voiceover, duration_ms }
    : voiceover
      ? { animation, voiceover_text: voiceover }
      : { animation };

/** Phase 6: Templates for math concepts. Ace references by id. */
export const VISUAL_TEACHING_TEMPLATES: Record<VisualTeachingTemplateId, VisualTeachingTemplate> = {
  equal_groups: {
    id: 'equal_groups',
    default_voiceover: 'Multiplication means equal groups.',
    steps: [
      STEP('groups_appear', 'Watch. Here are some groups.'),
      STEP('dots_fill_groups', 'Each group has the same number.'),
      STEP('highlight_rows', 'We can count by rows.'),
      STEP('rotate_to_array', 'Or see them as an array.'),
    ],
  },
  arrays: {
    id: 'arrays',
    default_voiceover: 'An array has rows and columns.',
    steps: [
      STEP('object_appear', 'See the dots.'),
      STEP('highlight_rows', 'Rows go across.'),
      STEP('structure_reveal', 'Columns go down.'),
      STEP('counting', 'We count to find how many.'),
    ],
  },
  counting_groups: {
    id: 'counting_groups',
    default_voiceover: 'We count groups to find how many in all.',
    steps: [
      STEP('groups_appear', 'Here are the groups.'),
      STEP('counting', 'Count each group: one, two, three.'),
      STEP('highlighting', 'The last number is how many.'),
    ],
  },
  number_line_jump: {
    id: 'number_line_jump',
    default_voiceover: 'We can jump on the number line.',
    steps: [
      STEP('structure_reveal', 'This is the number line.'),
      STEP('object_appear', 'We start here.'),
      STEP('number_line_jump', 'We jump to add or subtract.'),
    ],
  },
  addition_combine: {
    id: 'addition_combine',
    default_voiceover: 'Addition means putting groups together.',
    steps: [
      STEP('groups_appear', 'Two groups.'),
      STEP('combine_groups', 'We put them together.'),
      STEP('counting', 'Count them all.'),
    ],
  },
  subtraction_take_away: {
    id: 'subtraction_take_away',
    default_voiceover: 'Subtraction means taking some away.',
    steps: [
      STEP('object_appear', 'We start with this many.'),
      STEP('take_away', 'We take some away.'),
      STEP('counting', 'What is left?'),
    ],
  },
  sound_to_letter_reveal: {
    id: 'sound_to_letter_reveal',
    default_voiceover: 'Listen. This sound goes with this letter.',
    steps: [
      STEP('sound_to_letter_reveal', 'Hear the sound.'),
      STEP('highlighting', 'See the letter.'),
      STEP('structure_reveal', 'Sound and letter go together.'),
    ],
  },
  blend_sound_sequence: {
    id: 'blend_sound_sequence',
    default_voiceover: 'We blend sounds to make a word.',
    steps: [
      STEP('object_appear', 'First sound.'),
      STEP('blend_sound_sequence', 'Next sound.'),
      STEP('stretch_and_merge_word', 'Blend them. One word.'),
    ],
  },
  stretch_and_merge_word: {
    id: 'stretch_and_merge_word',
    default_voiceover: 'Stretch the word, then say it fast.',
    steps: [
      STEP('highlight_beginning_sound', 'First sound.'),
      STEP('segment_into_phonemes', 'Each sound.'),
      STEP('stretch_and_merge_word', 'Now say it fast.'),
    ],
  },
  highlight_beginning_sound: {
    id: 'highlight_beginning_sound',
    default_voiceover: 'The first sound in the word.',
    steps: [
      STEP('object_appear', 'See the word.'),
      STEP('highlight_beginning_sound', 'Listen for the first sound.'),
      STEP('highlighting', 'There it is.'),
    ],
  },
  segment_into_phonemes: {
    id: 'segment_into_phonemes',
    default_voiceover: 'Break the word into sounds.',
    steps: [
      STEP('object_appear', 'One word.'),
      STEP('segment_into_phonemes', 'Say it slowly.'),
      STEP('structure_reveal', 'One sound for each part.'),
    ],
  },
};

/** Map skill slug (from deterministic builder) to template id — math */
export function getVisualTeachingTemplateForSkill(skillSlug: string): VisualTeachingTemplate | null {
  const map: Record<string, VisualTeachingTemplateId> = {
    'equal-groups': 'equal_groups',
    'counting': 'counting_groups',
    'addition': 'addition_combine',
    'subtraction': 'subtraction_take_away',
  };
  const id = map[skillSlug];
  if (!id) return null;
  return VISUAL_TEACHING_TEMPLATES[id];
}

/** Phase 7: Map reading skill slug to visual teaching template */
export function getVisualTeachingTemplateForReadingSkill(skillSlug: string): VisualTeachingTemplate | null {
  const map: Record<string, VisualTeachingTemplateId> = {
    'letter-recognition': 'sound_to_letter_reveal',
    'letter-sounds': 'sound_to_letter_reveal',
    'phoneme-matching': 'highlight_beginning_sound',
    'blending-cvc': 'blend_sound_sequence',
    'segmenting': 'segment_into_phonemes',
    'stretch_and_merge_word': 'stretch_and_merge_word',
    'sight-words-basic': 'highlight_beginning_sound',
    'simple-sentence-reading': 'stretch_and_merge_word',
  };
  const id = map[skillSlug];
  if (!id) return null;
  return VISUAL_TEACHING_TEMPLATES[id];
}
