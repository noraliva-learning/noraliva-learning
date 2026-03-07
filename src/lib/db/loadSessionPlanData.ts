/**
 * Loads domain exercises, mastery, and due reviews for session planning.
 * Used by API route generate plan.
 * Exercises are joined via lessons: exercises.lesson_id = lessons.id, lessons.skill_id = skills.id
 * (schema uses lesson_id on exercises, not skill_id).
 */

import { createClient } from '@/lib/supabase/server';
import type { ExerciseForPlan, MasteryForPlan } from '@/lib/session/sessionPlanner';

export type SessionPlanData = {
  exercises: ExerciseForPlan[];
  masteryBySkill: Map<string, MasteryForPlan>;
  dueReviewSkillIds: Set<string>;
  domainSlug: string;
};

export async function loadSessionPlanData(
  domainSlug: string,
  learnerId: string
): Promise<SessionPlanData | null> {
  const supabase = await createClient();

  const { data: domain } = await supabase
    .from('domains')
    .select('id')
    .eq('slug', domainSlug)
    .maybeSingle();
  if (!domain) return null;

  const exercises: ExerciseForPlan[] = [];
  const domainSkillIds: string[] = [];

  const { data: units } = await supabase
    .from('units')
    .select('id')
    .eq('domain_id', domain.id)
    .order('sort_order', { ascending: true });

  const skillIdList = units?.length
    ? (await (async () => {
        for (const unit of units!) {
          const { data: skills } = await supabase
            .from('skills')
            .select('id')
            .eq('unit_id', unit.id)
            .order('sort_order', { ascending: true });
          if (skills?.length) domainSkillIds.push(...skills.map((s) => s.id));
        }
        return domainSkillIds;
      })())
    : (await (async () => {
        const { data: skills } = await supabase
          .from('skills')
          .select('id')
          .eq('domain_id', domain.id)
          .order('sort_order', { ascending: true });
        if (skills?.length) domainSkillIds.push(...skills.map((s) => s.id));
        return domainSkillIds;
      })());

  for (const skillId of domainSkillIds) {
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id')
      .eq('skill_id', skillId)
      .order('sort_order', { ascending: true });
    if (!lessons?.length) continue;
    for (const lesson of lessons) {
      const { data: exs } = await supabase
        .from('exercises')
        .select('id, prompt')
        .eq('lesson_id', lesson.id)
        .order('sort_order', { ascending: true });
      if (exs?.length)
        exercises.push(...exs.map((e) => ({ id: e.id, skill_id: skillId, prompt: e.prompt })));
    }
  }

  if (exercises.length === 0) return { exercises: [], masteryBySkill: new Map(), dueReviewSkillIds: new Set(), domainSlug };

  const now = new Date().toISOString();
  const [{ data: masteryRows }, { data: reviewRows }] = await Promise.all([
    supabase
      .from('skill_mastery')
      .select('skill_id, mastery_probability, confidence_score, next_review_at, spaced_check_count')
      .eq('learner_id', learnerId)
      .in('skill_id', domainSkillIds),
    supabase
      .from('review_schedule')
      .select('skill_id, next_review_at')
      .eq('learner_id', learnerId)
      .in('skill_id', domainSkillIds),
  ]);

  const masteryBySkill = new Map<string, MasteryForPlan>();
  for (const m of masteryRows ?? []) {
    const row = m as { skill_id: string; mastery_probability: number; confidence_score: number; next_review_at: string | null; spaced_check_count?: number };
    masteryBySkill.set(row.skill_id, {
      mastery_probability: row.mastery_probability ?? 0.3,
      confidence_score: row.confidence_score ?? 0,
      next_review_at: row.next_review_at ?? null,
      spaced_check_count: row.spaced_check_count ?? 0,
    });
  }
  for (const r of reviewRows ?? []) {
    if (!masteryBySkill.has(r.skill_id))
      masteryBySkill.set(r.skill_id, {
        mastery_probability: 0.3,
        confidence_score: 0,
        next_review_at: r.next_review_at,
        spaced_check_count: 0,
      });
    else {
      const ex = masteryBySkill.get(r.skill_id)!;
      masteryBySkill.set(r.skill_id, { ...ex, next_review_at: r.next_review_at });
    }
  }
  const dueReviewSkillIds = new Set<string>(
    (reviewRows ?? []).filter((r) => r.next_review_at && r.next_review_at <= now).map((r) => r.skill_id)
  );
  for (const [skillId, m] of masteryBySkill) {
    if (m.next_review_at && m.next_review_at <= now) dueReviewSkillIds.add(skillId);
  }

  return { exercises, masteryBySkill, dueReviewSkillIds, domainSlug };
}

const FALLBACK_PLAN_LIMIT = 10;

/**
 * Returns up to N exercise IDs for the domain (by sort_order) when the spiral planner
 * has no due reviews / edge content. Uses exercises.lesson_id via lessons.
 */
export async function loadFallbackExerciseIds(
  domainSlug: string,
  limit: number = FALLBACK_PLAN_LIMIT
): Promise<string[]> {
  const supabase = await createClient();
  const { data: domain } = await supabase
    .from('domains')
    .select('id')
    .eq('slug', domainSlug)
    .maybeSingle();
  if (!domain) return [];

  const ids: string[] = [];
  const { data: units } = await supabase
    .from('units')
    .select('id')
    .eq('domain_id', domain.id)
    .order('sort_order', { ascending: true });

  const skillIds: string[] = units?.length
    ? (await (async () => {
        const out: string[] = [];
        for (const unit of units!) {
          const { data: skills } = await supabase
            .from('skills')
            .select('id')
            .eq('unit_id', unit.id)
            .order('sort_order', { ascending: true });
          if (skills?.length) out.push(...skills.map((s) => s.id));
        }
        return out;
      })())
    : (await supabase.from('skills').select('id').eq('domain_id', domain.id).order('sort_order', { ascending: true }))
        .data?.map((s) => s.id) ?? [];

  for (const skillId of skillIds) {
    if (ids.length >= limit) break;
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id')
      .eq('skill_id', skillId)
      .order('sort_order', { ascending: true });
    if (!lessons?.length) continue;
    for (const lesson of lessons) {
      if (ids.length >= limit) break;
      const { data: exs } = await supabase
        .from('exercises')
        .select('id')
        .eq('lesson_id', lesson.id)
        .order('sort_order', { ascending: true })
        .limit(limit - ids.length);
      if (exs?.length) ids.push(...exs.map((e) => e.id));
    }
  }
  return ids.slice(0, limit);
}
