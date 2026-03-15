/**
 * Phase 3B: Parent visibility — closed-loop data for one learner.
 * Phase 5: learner_insights, recent_episodes_for_review.
 * RLS: only parent or learner can read (can_access_learner).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getNextBestSkillForLearner } from '@/lib/instruction/next-skill-engine';

export type MasteryBySkillRow = {
  skill_id: string;
  skill_name: string;
  mastery_probability: number;
  confidence_score: number;
  attempts_count: number;
  next_review_at: string | null;
};

export type LatestLessonDecisionRow = {
  episode_id: string;
  domain: string;
  skill_name: string;
  promotion_decision: string;
  mastery_before: number | null;
  mastery_after: number | null;
  next_skill_reason: string | null;
  /** Phase 5B: "Why this lesson" summary from ace_planning_metadata */
  why_this_lesson_summary: string | null;
  created_at: string;
};

/** Phase 5: derived insight in plain English */
export type LearnerInsightRow = {
  insight_type: string;
  summary_plain_english: string;
  evidence_summary: Record<string, unknown>;
  updated_at: string;
};

/** Phase 5: recent episode summary for parent lesson review */
export type RecentEpisodeRow = {
  episode_id: string;
  skill_name: string;
  domain: string;
  promotion_decision: string | null;
  completion_status: string;
  workmat_used: boolean;
  workmat_validation_valid?: boolean;
  created_at: string;
};

export type ClosedLoopView = {
  learner_id: string;
  mastery_by_skill: MasteryBySkillRow[];
  latest_lesson_decision: LatestLessonDecisionRow | null;
  next_planned_skill: { skill_id: string; skill_name: string; reason: string; why: string | null } | null;
  recent_misconceptions: { tag: string; skill_id: string | null; created_at: string }[];
  scheduled_reviews: { skill_id: string; skill_name: string; next_review_at: string }[];
  /** Phase 5 */
  learner_insights: LearnerInsightRow[];
  recent_episodes_for_review: RecentEpisodeRow[];
};

export async function getClosedLoopView(
  supabase: SupabaseClient,
  learnerId: string,
  domain: string = 'math'
): Promise<ClosedLoopView | null> {
  const { data: domainRow } = await supabase
    .from('domains')
    .select('id')
    .eq('slug', domain)
    .maybeSingle();
  if (!domainRow) return null;

  const { data: skills } = await supabase
    .from('skills')
    .select('id, name')
    .eq('domain_id', domainRow.id);
  const skillIds = (skills ?? []).map((s) => s.id);
  const skillNameById = new Map((skills ?? []).map((s) => [s.id, s.name]));

  const [masteryRes, historyRes, misconceptionsRes, reviewRes, insightsRes, episodesRes] = await Promise.all([
    supabase
      .from('skill_mastery')
      .select('skill_id, mastery_probability, confidence_score, attempts_count, next_review_at')
      .eq('learner_id', learnerId)
      .in('skill_id', skillIds.length ? skillIds : ['00000000-0000-0000-0000-000000000000']),
    supabase
      .from('learner_lesson_history')
      .select('episode_id, domain, skill_name, promotion_decision, mastery_before, mastery_after, next_skill_reason, created_at')
      .eq('learner_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('attempt_misconceptions')
      .select('tag, skill_id, created_at')
      .eq('learner_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('review_schedule')
      .select('skill_id, next_review_at')
      .eq('learner_id', learnerId)
      .in('skill_id', skillIds.length ? skillIds : ['00000000-0000-0000-0000-000000000000'])
      .gte('next_review_at', new Date().toISOString()),
    supabase
      .from('learner_insights')
      .select('insight_type, summary_plain_english, evidence_summary, updated_at')
      .eq('learner_id', learnerId)
      .eq('domain', domain)
      .order('updated_at', { ascending: false }),
    supabase
      .from('learner_lesson_history')
      .select('episode_id, skill_name, domain, promotion_decision, created_at')
      .eq('learner_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const mastery_by_skill: MasteryBySkillRow[] = (masteryRes.data ?? []).map((m: Record<string, unknown>) => ({
    skill_id: m.skill_id as string,
    skill_name: skillNameById.get(m.skill_id as string) ?? '—',
    mastery_probability: (m.mastery_probability as number) ?? 0,
    confidence_score: (m.confidence_score as number) ?? 0,
    attempts_count: (m.attempts_count as number) ?? 0,
    next_review_at: (m.next_review_at as string) ?? null,
  }));

  const latestRow = historyRes.data?.[0] as Record<string, unknown> | undefined;
  let whyThisLessonSummary: string | null = null;
  if (latestRow?.episode_id) {
    const { data: ep } = await supabase
      .from('lesson_episodes')
      .select('lesson_plan_json')
      .eq('id', latestRow.episode_id as string)
      .maybeSingle();
    const plan = ep?.lesson_plan_json as { ace_planning_metadata?: { why_this_lesson_summary?: string } } | undefined;
    whyThisLessonSummary = plan?.ace_planning_metadata?.why_this_lesson_summary ?? null;
  }
  const latest_lesson_decision: LatestLessonDecisionRow | null = latestRow
    ? {
        episode_id: latestRow.episode_id as string,
        domain: latestRow.domain as string,
        skill_name: latestRow.skill_name as string,
        promotion_decision: latestRow.promotion_decision as string,
        mastery_before: latestRow.mastery_before as number | null,
        mastery_after: latestRow.mastery_after as number | null,
        next_skill_reason: latestRow.next_skill_reason as string | null,
        why_this_lesson_summary: whyThisLessonSummary,
        created_at: latestRow.created_at as string,
      }
    : null;

  const nextSkill = await getNextBestSkillForLearner(supabase, learnerId, domain);
  const next_planned_skill = nextSkill
    ? {
        skill_id: nextSkill.skill_id,
        skill_name: nextSkill.skill_name,
        reason: nextSkill.reason,
        why: nextSkill.why ?? null,
      }
    : null;

  const recent_misconceptions = (misconceptionsRes.data ?? []).map((r: Record<string, unknown>) => ({
    tag: r.tag as string,
    skill_id: (r.skill_id as string) ?? null,
    created_at: r.created_at as string,
  }));

  const scheduled_reviews = (reviewRes.data ?? []).map((r: Record<string, unknown>) => ({
    skill_id: r.skill_id as string,
    skill_name: skillNameById.get(r.skill_id as string) ?? '—',
    next_review_at: r.next_review_at as string,
  }));

  const learner_insights: LearnerInsightRow[] = (insightsRes.data ?? []).map((r: Record<string, unknown>) => ({
    insight_type: r.insight_type as string,
    summary_plain_english: r.summary_plain_english as string,
    evidence_summary: (r.evidence_summary as Record<string, unknown>) ?? {},
    updated_at: r.updated_at as string,
  }));

  const episodeIds = (episodesRes.data ?? []).map((r: Record<string, unknown>) => r.episode_id as string);
  let recent_episodes_for_review: RecentEpisodeRow[] = [];
  if (episodeIds.length > 0) {
    const { data: epRows } = await supabase
      .from('lesson_episodes')
      .select('id, skill, domain, completion_status, promotion_decision, workmat_output')
      .in('id', episodeIds)
      .eq('learner_id', learnerId);
    const epMap = new Map(
      (epRows ?? []).map((e: Record<string, unknown>) => [
        e.id as string,
        {
          skill_name: e.skill as string,
          domain: e.domain as string,
          completion_status: (e.completion_status as string) ?? 'in_progress',
          promotion_decision: (e.promotion_decision as string) ?? null,
          workmat_used: Boolean((e.workmat_output as { workmat_used?: boolean })?.workmat_used),
          workmat_validation_valid: (e.workmat_output as { validation_result?: { valid?: boolean } })?.validation_result?.valid,
        },
      ])
    );
    const historyOrdered = (episodesRes.data ?? []) as { episode_id: string; skill_name: string; domain: string; promotion_decision: string | null; created_at: string }[];
    recent_episodes_for_review = historyOrdered.map((h) => {
      const ep = epMap.get(h.episode_id);
      return {
        episode_id: h.episode_id,
        skill_name: ep?.skill_name ?? h.skill_name,
        domain: ep?.domain ?? h.domain,
        promotion_decision: ep?.promotion_decision ?? h.promotion_decision,
        completion_status: ep?.completion_status ?? 'completed',
        workmat_used: ep?.workmat_used ?? false,
        workmat_validation_valid: ep?.workmat_validation_valid,
        created_at: h.created_at,
      };
    });
  }

  return {
    learner_id: learnerId,
    mastery_by_skill,
    latest_lesson_decision,
    next_planned_skill,
    recent_misconceptions,
    scheduled_reviews,
    learner_insights,
    recent_episodes_for_review,
  };
}
