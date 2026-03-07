/**
 * Short micro-lesson copy per misconception tag (Phase 2).
 * Used when struggle rule triggers; deterministic, no AI.
 */

import { MISCONCEPTION_TAGS, type DomainSlug } from './misconceptionTags';

const MICRO_LESSONS: Record<string, string> = {
  // Math
  regrouping: 'When we add or subtract, we regroup by moving 1 ten to the ones place (or the other way). Try counting the ones first, then the tens.',
  place_value: 'Each digit has a place: ones, tens, hundreds. The same digit means something different in each place.',
  operation_confusion: 'Addition means putting together; subtraction means taking away. Check which one the question is asking.',
  fact_retrieval: 'Practice your number facts so they come quickly. You can use counting or number lines to check.',
  // Reading
  phoneme_confusion: 'Some sounds are tricky. Say the word slowly and listen to each sound.',
  decoding_error: 'Sound out each letter or chunk, then blend the sounds together.',
  comprehension_gap: 'After reading, ask yourself: what happened? Reread the sentence if needed.',
  // Writing
  capitalization: 'Start sentences with a capital letter. Names and "I" are always capitalized.',
  punctuation: 'Every sentence needs an end mark: . ? or !',
  structure: 'A sentence needs a who and a what: someone doing something.',
  // Architecture
  symmetry: 'A shape is symmetric if one half matches the other when you fold or flip.',
  rotation: 'Rotation means turning the shape around a point. Count how far it turned.',
  pattern_continuation: 'Look at what repeats in the pattern. What comes next in the same way?',
  // Spanish
  gender_agreement: 'In Spanish, nouns have gender (el/la). The adjective must match the noun.',
  false_cognates: 'Some words look like English but mean something different. Check the meaning.',
  verb_tense: 'The verb ending tells you when: past, present, or future. Match it to the sentence.',
  vocab_confusion: 'Learn the word for this so you can recognize it next time.',
  general: 'Take your time. Try again—you can do it!',
};

export function getMicroLessonForTag(tag: string): string {
  return MICRO_LESSONS[tag] ?? MICRO_LESSONS.general;
}
