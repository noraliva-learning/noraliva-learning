/**
 * Phase 7: Reading skill progression — gold-standard exemplar.
 * Order and prerequisite logic align with migration 00019.
 * Used by deterministic builder and next-skill when domain is reading.
 */

export const READING_SKILL_SLUGS = [
  'letter-recognition',
  'letter-sounds',
  'phoneme-matching',
  'blending-cvc',
  'segmenting',
  'sight-words-basic',
  'simple-sentence-reading',
] as const;

export type ReadingSkillSlug = (typeof READING_SKILL_SLUGS)[number];

export const READING_SKILL_PATTERNS: { slug: ReadingSkillSlug; name: string; why: string }[] = [
  { slug: 'letter-recognition', name: 'Letter recognition', why: 'Knowing letters by name and shape.' },
  { slug: 'letter-sounds', name: 'Letter sounds', why: 'Each letter has a sound.' },
  { slug: 'phoneme-matching', name: 'Phoneme matching', why: 'Matching sounds to letters.' },
  { slug: 'blending-cvc', name: 'Blending CVC words', why: 'Putting sounds together to read a word.' },
  { slug: 'segmenting', name: 'Segmenting simple words', why: 'Breaking words into sounds.' },
  { slug: 'sight-words-basic', name: 'Sight words', why: 'Reading words you know by sight.' },
  { slug: 'simple-sentence-reading', name: 'Simple sentence reading', why: 'Reading a short sentence.' },
];

/** Prerequisite chain: each key requires the value(s) to be met first. */
export const READING_PREREQUISITES: Record<ReadingSkillSlug, ReadingSkillSlug | null> = {
  'letter-recognition': null,
  'letter-sounds': 'letter-recognition',
  'phoneme-matching': 'letter-sounds',
  'blending-cvc': 'phoneme-matching',
  'segmenting': 'blending-cvc',
  'sight-words-basic': 'segmenting',
  'simple-sentence-reading': 'sight-words-basic',
};

export function getReadingSkillBySlug(slug: string): (typeof READING_SKILL_PATTERNS)[number] | null {
  return READING_SKILL_PATTERNS.find((p) => p.slug === slug || p.name.toLowerCase().includes(slug.toLowerCase())) ?? null;
}

export function getFirstReadingSkill(): (typeof READING_SKILL_PATTERNS)[number] {
  return READING_SKILL_PATTERNS[0];
}
