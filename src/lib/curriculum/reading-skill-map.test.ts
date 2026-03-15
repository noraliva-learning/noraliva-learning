import { describe, it, expect } from 'vitest';
import {
  READING_SKILL_SLUGS,
  READING_SKILL_PATTERNS,
  READING_PREREQUISITES,
  getReadingSkillBySlug,
  getFirstReadingSkill,
} from './reading-skill-map';

describe('reading-skill-map', () => {
  it('exports skill slugs in curriculum order', () => {
    expect(READING_SKILL_SLUGS).toContain('letter-recognition');
    expect(READING_SKILL_SLUGS).toContain('letter-sounds');
    expect(READING_SKILL_SLUGS).toContain('sight-words-basic');
    expect(READING_SKILL_SLUGS).toContain('simple-sentence-reading');
    expect(READING_SKILL_SLUGS.length).toBe(7);
  });

  it('first skill has no prerequisite', () => {
    expect(READING_PREREQUISITES['letter-recognition']).toBeNull();
  });

  it('prerequisite chain is linear', () => {
    expect(READING_PREREQUISITES['letter-sounds']).toBe('letter-recognition');
    expect(READING_PREREQUISITES['simple-sentence-reading']).toBe('sight-words-basic');
  });

  it('getReadingSkillBySlug returns skill by slug or name', () => {
    expect(getReadingSkillBySlug('letter-recognition')?.name).toBe('Letter recognition');
    expect(getReadingSkillBySlug('Blending CVC words')?.slug).toBe('blending-cvc');
    expect(getReadingSkillBySlug('unknown')).toBeNull();
  });

  it('getFirstReadingSkill returns letter recognition', () => {
    expect(getFirstReadingSkill().slug).toBe('letter-recognition');
  });

  it('each pattern has name and why', () => {
    for (const p of READING_SKILL_PATTERNS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.why.length).toBeGreaterThan(0);
    }
  });
});
