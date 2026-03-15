import { describe, it, expect } from 'vitest';
import { getNextSkillIdInCurriculum } from './next-skill-engine';

describe('next-skill-engine', () => {
  describe('getNextSkillIdInCurriculum', () => {
    it('returns next skill id in order', () => {
      const ordered = [
        { skill_id: 'a' },
        { skill_id: 'b' },
        { skill_id: 'c' },
      ];
      expect(getNextSkillIdInCurriculum(ordered, 'a')).toBe('b');
      expect(getNextSkillIdInCurriculum(ordered, 'b')).toBe('c');
    });

    it('returns null for last skill', () => {
      const ordered = [{ skill_id: 'a' }, { skill_id: 'b' }];
      expect(getNextSkillIdInCurriculum(ordered, 'b')).toBe(null);
    });

    it('returns null when skill not in list', () => {
      const ordered = [{ skill_id: 'a' }];
      expect(getNextSkillIdInCurriculum(ordered, 'x')).toBe(null);
    });

    it('returns null for empty list', () => {
      expect(getNextSkillIdInCurriculum([], 'a')).toBe(null);
    });
  });
});
