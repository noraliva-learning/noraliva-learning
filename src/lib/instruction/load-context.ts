/**
 * Phase 3: Load learner context for the Ace Instruction Engine.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  InstructionEngineInput,
  MasterySnapshot,
  RecentAttempt,
  MisconceptionRecord,
} from './engine-types';

const RECENT_ATTEMPTS_LIMIT = 20;
const MISCONCEPTIONS_LIMIT = 10;
const REVIEW_SCHEDULE_LIMIT = 30;

export async function loadInstructionEngineInput(
  supabase: SupabaseClient,
  learnerId: string,
  domain: string,
  learnerSlug?: 'liv' | 'elle',
  candidateSkillId?: string | null,
  candidateSkillName?: string | null
): Promise<InstructionEngineInput | null> {
  const { data: domainRow } = await supabase
    .from('domains')
    .select('id')
    .eq('slug', domain)
    .maybeSingle();
  if (!domainRow) return null;

  const domainId = domainRow.id;
  let skillIds: string[] = [];

  const { data: units } = await supabase
    .from('units')
    .select('id')
    .eq('domain_id', domainId)
    .order('sort_order', { ascending: true });

  if (units?.length) {
    for (const u of units) {
      const { data: skills } = await supabase
        .from('skills')
        .select('id, name')
        .eq('unit_id', u.id)
        .order('sort_order', { ascending: true });
      if (skills?.length) skillIds.push(...skills.map((s) => s.id));
    }
  }
  if (skillIds.length === 0) {
    const { data: skills } = await supabase
      .from('skills')
      .select('id, name')
      .eq('domain_id', domainId)
      .order('sort_order', { ascending: true });
    skillIds = (skills ?? []).map((s) => s.id);
  }

  const [masteryRes, attemptsRes, misconceptionsRes, reviewRes, hintUsageRes, insightsRes] = await Promise.all([
    supabase
      .from('skill_mastery')
      .select('skill_id, mastery_probability, confidence_score, next_review_at, spaced_check_count')
      .eq('learner_id', learnerId)
      .in('skill_id', skillIds.length ? skillIds : ['00000000-0000-0000-0000-000000000000']),
    supabase
      .from('attempts')
      .select('exercise_id, correct, created_at')
      .eq('learner_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(RECENT_ATTEMPTS_LIMIT),
    supabase
      .from('attempt_misconceptions')
      .select('skill_id, tag, created_at')
      .eq('learner_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(MISCONCEPTIONS_LIMIT),
    supabase
      .from('review_schedule')
      .select('skill_id, next_review_at')
      .eq('learner_id', learnerId)
      .in('skill_id', skillIds.length ? skillIds : ['00000000-0000-0000-0000-000000000000'])
      .limit(REVIEW_SCHEDULE_LIMIT),
    supabase
      .from('attempts')
      .select('exercise_id')
      .eq('learner_id', learnerId),
    supabase
      .from('learner_insights')
      .select('insight_type, summary_plain_english')
      .eq('learner_id', learnerId)
      .eq('domain', domain)
      .order('updated_at', { ascending: false })
      .limit(20),
  ]);

  const masteryBySkill = new Map<string, MasterySnapshot>();
  for (const row of masteryRes.data ?? []) {
    const r = row as {
      skill_id: string;
      mastery_probability: number;
      confidence_score: number;
      next_review_at: string | null;
      spaced_check_count: number;
    };
    masteryBySkill.set(r.skill_id, {
      skill_id: r.skill_id,
      mastery_probability: r.mastery_probability ?? 0.3,
      confidence_score: r.confidence_score ?? 0,
      next_review_at: r.next_review_at ?? null,
      spaced_check_count: r.spaced_check_count ?? 0,
    });
  }

  const exerciseToSkill = new Map<string, string>();
  for (const skillId of skillIds) {
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id')
      .eq('skill_id', skillId);
    if (!lessons?.length) continue;
    for (const les of lessons) {
      const { data: exs } = await supabase.from('exercises').select('id').eq('lesson_id', les.id);
      for (const ex of exs ?? []) {
        exerciseToSkill.set(ex.id, skillId);
      }
    }
  }

  const recentAttempts: RecentAttempt[] = (attemptsRes.data ?? []).map((row: Record<string, unknown>) => {
    const exId = row.exercise_id as string;
    return {
      exercise_id: exId,
      skill_id: exerciseToSkill.get(exId) ?? '',
      correct: Boolean(row.correct),
      created_at: String(row.created_at),
    };
  });

  const misconceptionHistory: MisconceptionRecord[] = (misconceptionsRes.data ?? []).map(
    (row: Record<string, unknown>) => ({
      skill_id: (row.skill_id as string) ?? null,
      tag: String(row.tag ?? ''),
      created_at: String(row.created_at),
    })
  );

  const hintCountBySkill = new Map<string, number>();
  for (const a of recentAttempts) {
    if (a.skill_id) hintCountBySkill.set(a.skill_id, (hintCountBySkill.get(a.skill_id) ?? 0) + 1);
  }
  const hint_usage = Array.from(hintCountBySkill.entries()).map(([skill_id, count]) => ({
    skill_id,
    count,
  }));

  const recentReviewSchedule = (reviewRes.data ?? []).map((row: Record<string, unknown>) => ({
    skill_id: String(row.skill_id),
    next_review_at: String(row.next_review_at),
  }));

  const current_mastery = Array.from(masteryBySkill.values());

  const learner_insights = (insightsRes.data ?? []).map((row: Record<string, unknown>) => ({
    insight_type: row.insight_type as string,
    summary_plain_english: row.summary_plain_english as string,
  }));

  return {
    learner_id: learnerId,
    learner_slug: learnerSlug,
    domain,
    current_mastery,
    recent_attempts: recentAttempts,
    misconception_history: misconceptionHistory,
    hint_usage,
    recent_review_schedule: recentReviewSchedule,
    candidate_skill_id: candidateSkillId ?? null,
    candidate_skill_name: candidateSkillName ?? null,
    learner_insights,
  };
}
