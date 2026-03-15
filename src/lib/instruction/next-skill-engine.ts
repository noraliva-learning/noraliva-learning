/**
 * Phase 3B: Next-skill decision engine.
 * getNextBestSkillForLearner(learnerId, domain) — used by lesson-plan generation.
 * Math-only for now: advance, reinforce, bridge to prerequisite, scheduled review.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSkillsWithPrerequisitesMet } from '@/lib/curriculum/skillGraph';

export type NextSkillResult = {
  skill_id: string;
  skill_name: string;
  reason: 'advance' | 'reinforce' | 'bridge_prerequisite' | 'scheduled_review';
  why: string;
} | null;

/**
 * Get ordered skill IDs and names for a domain (math: by units then sort_order).
 */
export async function getDomainSkillsOrdered(
  supabase: SupabaseClient,
  domainSlug: string
): Promise<{ skill_id: string; skill_name: string }[]> {
  const { data: domain } = await supabase
    .from('domains')
    .select('id')
    .eq('slug', domainSlug)
    .maybeSingle();
  if (!domain) return [];

  const { data: units } = await supabase
    .from('units')
    .select('id')
    .eq('domain_id', domain.id)
    .order('sort_order', { ascending: true });

  const skills: { skill_id: string; skill_name: string }[] = [];

  if (units?.length) {
    for (const u of units) {
      const { data: skillRows } = await supabase
        .from('skills')
        .select('id, name')
        .eq('unit_id', u.id)
        .order('sort_order', { ascending: true });
      if (skillRows?.length) skills.push(...skillRows.map((s) => ({ skill_id: s.id, skill_name: s.name })));
    }
  }
  if (skills.length === 0) {
    const { data: skillRows } = await supabase
      .from('skills')
      .select('id, name')
      .eq('domain_id', domain.id)
      .order('sort_order', { ascending: true });
    if (skillRows?.length) skills.push(...skillRows.map((s) => ({ skill_id: s.id, skill_name: s.name })));
  }

  return skills;
}

/**
 * Get the next best skill for the learner in the given domain.
 * 1. Due review (review_schedule.next_review_at <= now) -> return that skill
 * 2. Otherwise use candidate from instruction engine (caller can pass from last lesson outcome)
 * 3. Else first eligible skill in curriculum order
 */
export async function getNextBestSkillForLearner(
  supabase: SupabaseClient,
  learnerId: string,
  domainSlug: string,
  options?: { preferredSkillId?: string | null; preferredReason?: string }
): Promise<NextSkillResult> {
  const allSkills = await getDomainSkillsOrdered(supabase, domainSlug);
  if (allSkills.length === 0) return null;

  const domainSkillIds = allSkills.map((s) => s.skill_id);
  const eligible = await getSkillsWithPrerequisitesMet(supabase, learnerId, domainSkillIds);

  const now = new Date().toISOString();

  const { data: reviewRows } = await supabase
    .from('review_schedule')
    .select('skill_id')
    .eq('learner_id', learnerId)
    .in('skill_id', domainSkillIds)
    .lte('next_review_at', now)
    .order('next_review_at', { ascending: true })
    .limit(1);

  if (reviewRows?.length && reviewRows[0]) {
    const skillId = (reviewRows[0] as { skill_id: string }).skill_id;
    const skill = allSkills.find((s) => s.skill_id === skillId);
    if (skill && eligible.has(skillId)) {
      return {
        skill_id: skill.skill_id,
        skill_name: skill.skill_name,
        reason: 'scheduled_review',
        why: 'Scheduled review is due.',
      };
    }
  }

  if (options?.preferredSkillId && eligible.has(options.preferredSkillId)) {
    const skill = allSkills.find((s) => s.skill_id === options!.preferredSkillId!);
    if (skill) {
      return {
        skill_id: skill.skill_id,
        skill_name: skill.skill_name,
        reason: options.preferredReason === 'scheduled_review' ? 'scheduled_review' : options.preferredReason === 'advance' ? 'advance' : 'reinforce',
        why: options.preferredReason ?? 'Recommended from last lesson.',
      };
    }
  }

  const firstEligible = allSkills.find((s) => eligible.has(s.skill_id));
  if (firstEligible) {
    return {
      skill_id: firstEligible.skill_id,
      skill_name: firstEligible.skill_name,
      reason: 'advance',
      why: 'Next skill in curriculum.',
    };
  }

  return null;
}

/**
 * Get skill that comes after the given skill_id in curriculum order.
 */
export function getNextSkillIdInCurriculum(
  orderedSkills: { skill_id: string }[],
  currentSkillId: string
): string | null {
  const idx = orderedSkills.findIndex((s) => s.skill_id === currentSkillId);
  if (idx < 0 || idx >= orderedSkills.length - 1) return null;
  return orderedSkills[idx + 1].skill_id;
}
