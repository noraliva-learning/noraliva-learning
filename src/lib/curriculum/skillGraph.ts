/**
 * PASS 1: Skill graph — prerequisite-aware eligibility.
 * A prerequisite is met only if skill_mastery.mastery_probability >= PREREQ_MASTERY_THRESHOLD.
 * Does NOT unlock based on prior attempt alone.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Minimum mastery_probability to consider a prerequisite "met". Conservative. */
export const PREREQ_MASTERY_THRESHOLD = 0.85;

export type PrereqRow = { skill_id: string; prerequisite_skill_id: string };
export type MasteryRow = { skill_id: string; mastery_probability: number };

/**
 * Pure: given domain skills, prerequisite edges, and learner mastery, returns eligible skill IDs.
 * A skill is eligible if it has no prerequisites or every prerequisite has mastery_probability >= threshold.
 */
export function computeEligibleFromPrereqsAndMastery(
  domainSkillIds: string[],
  prereqRows: PrereqRow[],
  masteryRows: MasteryRow[]
): Set<string> {
  const prereqsBySkill = new Map<string, string[]>();
  const masteryBySkill = new Map<string, number>();
  for (const row of prereqRows) {
    if (!prereqsBySkill.has(row.skill_id)) prereqsBySkill.set(row.skill_id, []);
    prereqsBySkill.get(row.skill_id)!.push(row.prerequisite_skill_id);
  }
  for (const row of masteryRows) {
    masteryBySkill.set(row.skill_id, row.mastery_probability ?? 0);
  }
  const eligible = new Set<string>();
  for (const skillId of domainSkillIds) {
    const prereqIds = prereqsBySkill.get(skillId);
    if (!prereqIds || prereqIds.length === 0) {
      eligible.add(skillId);
      continue;
    }
    const allMet = prereqIds.every(
      (prereqId) => (masteryBySkill.get(prereqId) ?? 0) >= PREREQ_MASTERY_THRESHOLD
    );
    if (allMet) eligible.add(skillId);
  }
  return eligible;
}

/**
 * Returns the set of domain skill IDs that are eligible for the learner:
 * - Skills with no prerequisites are always eligible.
 * - A skill with prerequisites is eligible only if every prerequisite has
 *   skill_mastery.mastery_probability >= PREREQ_MASTERY_THRESHOLD.
 * @param supabase Server Supabase client
 * @param learnerId Current learner
 * @param domainSkillIds All skill IDs in the domain (curriculum order)
 */
export async function getSkillsWithPrerequisitesMet(
  supabase: SupabaseClient,
  learnerId: string,
  domainSkillIds: string[]
): Promise<Set<string>> {
  if (domainSkillIds.length === 0) return new Set();

  const { data: prereqRows, error: prereqError } = await supabase
    .from('skill_prerequisites')
    .select('skill_id, prerequisite_skill_id')
    .in('skill_id', domainSkillIds);

  if (prereqError) throw prereqError;

  const prereqList: PrereqRow[] = (prereqRows ?? []).map((r) => ({
    skill_id: (r as { skill_id: string }).skill_id,
    prerequisite_skill_id: (r as { prerequisite_skill_id: string }).prerequisite_skill_id,
  }));
  const allPrereqIds = new Set(prereqList.flatMap((r) => [r.prerequisite_skill_id]));

  let masteryList: MasteryRow[] = [];
  if (allPrereqIds.size > 0) {
    const { data: masteryRows, error: masteryError } = await supabase
      .from('skill_mastery')
      .select('skill_id, mastery_probability')
      .eq('learner_id', learnerId)
      .in('skill_id', [...allPrereqIds]);

    if (masteryError) throw masteryError;
    masteryList = (masteryRows ?? []).map((m) => ({
      skill_id: (m as { skill_id: string }).skill_id,
      mastery_probability: (m as { mastery_probability: number }).mastery_probability ?? 0,
    }));
  }

  return computeEligibleFromPrereqsAndMastery(domainSkillIds, prereqList, masteryList);
}
