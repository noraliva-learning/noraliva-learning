import { describe, expect, it } from 'vitest';
import { classifyMisconception } from './misconceptionClassifier';

describe('classifyMisconception', () => {
  it('returns tag for math domain', () => {
    const tag = classifyMisconception({ domain: 'math', skillSlug: 'addition-basic' });
    expect(['regrouping', 'place_value', 'operation_confusion', 'fact_retrieval']).toContain(tag);
  });

  it('returns tag for reading domain', () => {
    const tag = classifyMisconception({ domain: 'reading', skillSlug: 'sight-words' });
    expect(['phoneme_confusion', 'decoding_error', 'comprehension_gap']).toContain(tag);
  });

  it('is deterministic: same inputs yield same tag', () => {
    const a = classifyMisconception({ domain: 'math', skillSlug: 'foo', exerciseId: 'e1' });
    const b = classifyMisconception({ domain: 'math', skillSlug: 'foo', exerciseId: 'e1' });
    expect(a).toBe(b);
  });

  it('different exercise id can yield different tag', () => {
    const tags = new Set<string>();
    for (let i = 0; i < 20; i++) {
      tags.add(classifyMisconception({ domain: 'math', skillSlug: 'x', exerciseId: `e${i}` }));
    }
    expect(tags.size).toBeGreaterThan(1);
  });

  it('returns general for unknown domain', () => {
    const tag = classifyMisconception({ domain: 'spanish', skillSlug: 'greetings' });
    expect(['gender_agreement', 'false_cognates', 'verb_tense', 'vocab_confusion']).toContain(tag);
  });
});
