/**
 * Misconception tags per domain (deterministic classifier uses these).
 * Phase 2: rule-based; AI in Phase 5.
 */
export const MISCONCEPTION_TAGS = {
  math: [
    'regrouping',
    'place_value',
    'operation_confusion',
    'fact_retrieval',
  ] as const,
  reading: [
    'phoneme_confusion',
    'decoding_error',
    'comprehension_gap',
  ] as const,
  writing: [
    'capitalization',
    'punctuation',
    'structure',
  ] as const,
  architecture: [
    'symmetry',
    'rotation',
    'pattern_continuation',
  ] as const,
  spanish: [
    'gender_agreement',
    'false_cognates',
    'verb_tense',
    'vocab_confusion',
  ] as const,
} as const;

export type MathTag = (typeof MISCONCEPTION_TAGS.math)[number];
export type ReadingTag = (typeof MISCONCEPTION_TAGS.reading)[number];
export type WritingTag = (typeof MISCONCEPTION_TAGS.writing)[number];
export type ArchitectureTag = (typeof MISCONCEPTION_TAGS.architecture)[number];
export type SpanishTag = (typeof MISCONCEPTION_TAGS.spanish)[number];

export type MisconceptionTagByDomain = {
  math: MathTag;
  reading: ReadingTag;
  writing: WritingTag;
  architecture: ArchitectureTag;
  spanish: SpanishTag;
};

export type DomainSlug = keyof typeof MISCONCEPTION_TAGS;

export function getTagsForDomain(domain: DomainSlug): readonly string[] {
  return MISCONCEPTION_TAGS[domain] ?? [];
}
