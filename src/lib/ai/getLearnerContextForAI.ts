/**
 * Load learner context for AI exercise generation: skills in domain,
 * mastery, recent performance, misconceptions, learner profile (age/grade),
 * last attempt in this session, recent prompts in session, and due-review skills.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { edgeOfLearningScore } from '@/lib/mastery/masteryEngine';
import { getRecentMisconceptionCounts } from '@/lib/db/misconceptions';
import { getLearnerProfile } from '@/lib/learners';

export type LearnerContextForAI = {
  learnerId: string;
  learnerSlug: string;
  age: number;
  gradeLabel: string;
  domain: string;
  skillId: string;
  skillSlug: string;
  skillName: string;
  masteryLevel: number;
  masteryProbability: number;
  confidenceScore: number;
  recentPerformance: { correct: boolean }[];
  misconceptions: string[];
  /** Last attempt in this session (so we can adapt: correct → harder, incorrect → easier) */
  lastAttemptInSession: { correct: boolean; skillId: string } | null;
  /** Prompts already shown this session — do not repeat */
  recentPromptsInSession: string[];
  /** Skills due for review (next_review_at <= now) */
  dueReviewSkillIds: string[];
};

export async function getLearnerContextForGeneration(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  sessionId: string,
  preferredSkillId?: string
): Promise<LearnerContextForAI | null> {
  const { data: session, error: sessionError } = await supabase
    .from('learning_sessions')
    .select('learner_id, domain')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError || !session) return null;
  const learnerId = session.learner_id;
  const domain = session.domain as string;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, age, grade_label')
    .eq('id', learnerId)
    .maybeSingle();
  const learnerSlug = (profile?.role === 'liv' || profile?.role === 'elle' ? profile.role : 'liv') as string;
  const profileLearner = getLearnerProfile(learnerSlug);
  const age = profile?.age ?? profileLearner.age;
  const gradeLabel = (profile?.grade_label?.trim() || profileLearner.gradeLabel) as string;

  const { data: domainRow } = await supabase
    .from('domains')
    .select('id')
    .eq('slug', domain)
    .single();
  if (!domainRow) return null;

  let skills: { id: string; slug: string; name: string }[] = [];
  const { data: domainSkills } = await supabase
    .from('skills')
    .select('id, slug, name')
    .eq('domain_id', domainRow.id);
  skills = domainSkills ?? [];

  if (!skills.length) {
    const { data: mathDomain } = await supabase
      .from('domains')
      .select('id')
      .eq('slug', 'math')
      .single();
    if (mathDomain) {
      const { data: mathSkills } = await supabase
        .from('skills')
        .select('id, slug, name')
        .eq('domain_id', mathDomain.id);
      skills = mathSkills ?? [];
    }
  }
  if (!skills.length) return null;

  const skillIds = skills.map((s) => s.id);
  const { data: masteryRows } = await supabase
    .from('skill_mastery')
    .select('skill_id, mastery_probability, confidence_score, level, spaced_check_count, next_review_at')
    .eq('learner_id', learnerId)
    .in('skill_id', skillIds);

  const masteryBySkill = new Map(
    (masteryRows ?? []).map((m) => [
      m.skill_id,
      {
        mastery_probability: (m as { mastery_probability?: number }).mastery_probability ?? 0.3,
        confidence_score: (m as { confidence_score?: number }).confidence_score ?? 0,
        level: (m as { level?: number }).level ?? 0,
        spaced_check_count: (m as { spaced_check_count?: number }).spaced_check_count ?? 0,
        next_review_at: (m as { next_review_at?: string | null }).next_review_at ?? null,
      },
    ])
  );

  const now = new Date().toISOString();
  const dueReviewSkillIds = skillIds.filter((id) => {
    const m = masteryBySkill.get(id);
    const nextReview = (m as { next_review_at?: string | null })?.next_review_at;
    return nextReview && nextReview <= now;
  });

  let skillId: string;
  let skillSlug: string;
  let skillName: string;
  if (preferredSkillId && skills.some((s) => s.id === preferredSkillId)) {
    const s = skills.find((s) => s.id === preferredSkillId)!;
    skillId = s.id;
    skillSlug = s.slug;
    skillName = s.name;
  } else if (dueReviewSkillIds.length > 0) {
    const dueSkills = skills.filter((s) => dueReviewSkillIds.includes(s.id));
    dueSkills.sort((a, b) => {
      const probA = masteryBySkill.get(a.id)?.mastery_probability ?? 0.3;
      const probB = masteryBySkill.get(b.id)?.mastery_probability ?? 0.3;
      return probA - probB;
    });
    const chosen = dueSkills[0] ?? skills[0];
    skillId = chosen.id;
    skillSlug = chosen.slug;
    skillName = chosen.name;
  } else {
    const scores = skills.map((s) => {
      const m = masteryBySkill.get(s.id);
      const prob = m?.mastery_probability ?? 0.3;
      const conf = m?.confidence_score ?? 0;
      const score = edgeOfLearningScore(prob, conf);
      return { skill: s, score };
    });
    scores.sort((a, b) => b.score - a.score);
    const chosen = scores[0]?.skill ?? skills[0];
    skillId = chosen.id;
    skillSlug = chosen.slug;
    skillName = chosen.name;
  }

  const m = masteryBySkill.get(skillId);
  const masteryLevel = m?.level ?? 0;
  const masteryProbability = m?.mastery_probability ?? 0.3;
  const confidenceScore = m?.confidence_score ?? 0;

  const { data: attemptRows } = await supabase
    .from('attempts')
    .select('exercise_id, correct')
    .eq('learner_id', learnerId)
    .order('created_at', { ascending: false })
    .limit(20);

  const lessonIdsForSkill = await getLessonIdsForSkill(supabase, skillId);
  const { data: exRows } = await supabase
    .from('exercises')
    .select('id')
    .in('lesson_id', lessonIdsForSkill);
  const exerciseIdsForSkill = new Set((exRows ?? []).map((e) => e.id));
  const recentForSkill = (attemptRows ?? []).filter((a) => exerciseIdsForSkill.has(a.exercise_id));
  const recentPerformanceMapped = recentForSkill.map((a) => ({ correct: a.correct }));

  const misconceptionCounts = await getRecentMisconceptionCounts({
    learnerId,
    skillId,
    windowSize: 20,
  });
  const misconceptions = misconceptionCounts.map((c) => c.tag);

  const { data: sessionAttempts } = await supabase
    .from('attempts')
    .select('exercise_id, correct')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(20);
  const sessionAttemptRows = sessionAttempts ?? [];

  let lastAttemptInSession: { correct: boolean; skillId: string } | null = null;
  if (sessionAttemptRows.length > 0) {
    const first = sessionAttemptRows[0];
    const { data: ex } = await supabase
      .from('exercises')
      .select('lesson_id')
      .eq('id', first.exercise_id)
      .single();
    if (ex?.lesson_id) {
      const { data: lesson } = await supabase
        .from('lessons')
        .select('skill_id')
        .eq('id', ex.lesson_id)
        .single();
      const lastSkillId = (lesson as { skill_id?: string } | null)?.skill_id ?? skillId;
      lastAttemptInSession = { correct: first.correct, skillId: lastSkillId };
    } else {
      lastAttemptInSession = { correct: first.correct, skillId };
    }
  }

  const exerciseIdsInSession = [...new Set(sessionAttemptRows.map((a) => a.exercise_id))];
  let recentPromptsInSession: string[] = [];
  if (exerciseIdsInSession.length > 0) {
    const { data: exPrompts } = await supabase
      .from('exercises')
      .select('id, prompt')
      .in('id', exerciseIdsInSession);
    recentPromptsInSession = (exPrompts ?? []).map((e) => (e as { prompt?: string }).prompt ?? '').filter(Boolean);
  }

  return {
    learnerId,
    learnerSlug,
    age,
    gradeLabel,
    domain,
    skillId,
    skillSlug,
    skillName,
    masteryLevel,
    masteryProbability,
    confidenceScore,
    recentPerformance: recentPerformanceMapped,
    misconceptions,
    lastAttemptInSession,
    recentPromptsInSession,
    dueReviewSkillIds,
  };
}

async function getLessonIdsForSkill(
  supabase: SupabaseClient,
  skillId: string
): Promise<string[]> {
  const { data } = await supabase.from('lessons').select('id').eq('skill_id', skillId);
  return (data ?? []).map((l) => l.id);
}

/**
 * Get or create a lesson for a skill (for attaching AI-generated exercises).
 */
export async function getOrCreateLessonForSkill(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  skillId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('lessons')
    .select('id')
    .eq('skill_id', skillId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: inserted, error } = await supabase
    .from('lessons')
    .insert({ skill_id: skillId, title: 'Practice', sort_order: 0 })
    .select('id')
    .single();
  if (error || !inserted?.id) {
    console.error('[getOrCreateLessonForSkill] lesson insert failed:', error?.message ?? error, 'code:', error?.code);
    return null;
  }
  return inserted.id;
}
