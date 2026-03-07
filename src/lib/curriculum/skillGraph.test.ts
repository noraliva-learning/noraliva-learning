import { describe, expect, it } from 'vitest';
import {
  PREREQ_MASTERY_THRESHOLD,
  computeEligibleFromPrereqsAndMastery,
  type PrereqRow,
  type MasteryRow,
} from './skillGraph';

describe('skillGraph', () => {
  describe('PREREQ_MASTERY_THRESHOLD', () => {
    it('is 0.85 (conservative)', () => {
      expect(PREREQ_MASTERY_THRESHOLD).toBe(0.85);
    });
  });

  describe('computeEligibleFromPrereqsAndMastery', () => {
    it('returns all domain skills when no prerequisites', () => {
      const domainSkillIds = ['s1', 's2', 's3'];
      const prereqRows: PrereqRow[] = [];
      const masteryRows: MasteryRow[] = [];
      const eligible = computeEligibleFromPrereqsAndMastery(domainSkillIds, prereqRows, masteryRows);
      expect(eligible).toEqual(new Set(['s1', 's2', 's3']));
    });

    it('excludes skill when prerequisite has mastery below threshold', () => {
      const domainSkillIds = ['s1', 's2'];
      const prereqRows: PrereqRow[] = [{ skill_id: 's2', prerequisite_skill_id: 's1' }];
      const masteryRows: MasteryRow[] = [{ skill_id: 's1', mastery_probability: 0.5 }];
      const eligible = computeEligibleFromPrereqsAndMastery(domainSkillIds, prereqRows, masteryRows);
      expect(eligible.has('s1')).toBe(true);
      expect(eligible.has('s2')).toBe(false);
    });

    it('includes skill when prerequisite has mastery >= 0.85', () => {
      const domainSkillIds = ['s1', 's2'];
      const prereqRows: PrereqRow[] = [{ skill_id: 's2', prerequisite_skill_id: 's1' }];
      const masteryRows: MasteryRow[] = [{ skill_id: 's1', mastery_probability: 0.85 }];
      const eligible = computeEligibleFromPrereqsAndMastery(domainSkillIds, prereqRows, masteryRows);
      expect(eligible).toEqual(new Set(['s1', 's2']));
    });

    it('includes skill when prerequisite has mastery > 0.85', () => {
      const domainSkillIds = ['s1', 's2'];
      const prereqRows: PrereqRow[] = [{ skill_id: 's2', prerequisite_skill_id: 's1' }];
      const masteryRows: MasteryRow[] = [{ skill_id: 's1', mastery_probability: 0.9 }];
      const eligible = computeEligibleFromPrereqsAndMastery(domainSkillIds, prereqRows, masteryRows);
      expect(eligible).toEqual(new Set(['s1', 's2']));
    });

    it('excludes skill when prerequisite has no mastery row (treated as 0)', () => {
      const domainSkillIds = ['s1', 's2'];
      const prereqRows: PrereqRow[] = [{ skill_id: 's2', prerequisite_skill_id: 's1' }];
      const masteryRows: MasteryRow[] = [];
      const eligible = computeEligibleFromPrereqsAndMastery(domainSkillIds, prereqRows, masteryRows);
      expect(eligible.has('s1')).toBe(true);
      expect(eligible.has('s2')).toBe(false);
    });

    it('requires all prerequisites met when skill has multiple', () => {
      const domainSkillIds = ['s1', 's2', 's3'];
      const prereqRows: PrereqRow[] = [
        { skill_id: 's3', prerequisite_skill_id: 's1' },
        { skill_id: 's3', prerequisite_skill_id: 's2' },
      ];
      const masteryRows: MasteryRow[] = [
        { skill_id: 's1', mastery_probability: 0.9 },
        { skill_id: 's2', mastery_probability: 0.5 },
      ];
      const eligible = computeEligibleFromPrereqsAndMastery(domainSkillIds, prereqRows, masteryRows);
      expect(eligible.has('s1')).toBe(true);
      expect(eligible.has('s2')).toBe(true);
      expect(eligible.has('s3')).toBe(false);
    });

    it('includes skill when all prerequisites met', () => {
      const domainSkillIds = ['s1', 's2', 's3'];
      const prereqRows: PrereqRow[] = [
        { skill_id: 's3', prerequisite_skill_id: 's1' },
        { skill_id: 's3', prerequisite_skill_id: 's2' },
      ];
      const masteryRows: MasteryRow[] = [
        { skill_id: 's1', mastery_probability: 0.9 },
        { skill_id: 's2', mastery_probability: 0.85 },
      ];
      const eligible = computeEligibleFromPrereqsAndMastery(domainSkillIds, prereqRows, masteryRows);
      expect(eligible).toEqual(new Set(['s1', 's2', 's3']));
    });

    it('returns empty set when domainSkillIds is empty', () => {
      const eligible = computeEligibleFromPrereqsAndMastery([], [], []);
      expect(eligible).toEqual(new Set());
    });
  });
});
