/**
 * Phase 3B: Lesson completion — evaluate, update mastery, review schedule, audit.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLessonEpisode } from '@/lib/db/lessonEpisode';
import {
  upsertSkillMastery,
  upsertReviewSchedule,
  insertLearnerLessonHistory,
  updateLessonEpisodeOnComplete,
} from '@/lib/db/lessonCompletion';
import { insertLessonSignals } from '@/lib/db/lessonSignals';
import { upsertLearnerInsight } from '@/lib/db/learnerInsights';
import { deriveLearnerInsights } from '@/lib/signals/insight-engine';
import { learningSignalsSchema } from '@/lib/signals/learning-signals-schema';
import { evaluateLessonCompletion } from '@/lib/instruction/lesson-completion-evaluator';
import { getDomainSkillsOrdered, getNextSkillIdInCurriculum } from '@/lib/instruction/next-skill-engine';
import { lessonCompletionInputSchema } from '@/lib/instruction/completion-schemas';
import { lessonPlanSchema } from '@/lib/instruction/lesson-plan-schema';
import type { MasterySnapshot } from '@/lib/instruction/completion-schemas';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  try {
    const { episodeId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const parsed = lessonCompletionInputSchema.safeParse({ ...body, episode_id: episodeId });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
    }
    const completion = parsed.data;

    const episode = await getLessonEpisode(supabase, episodeId, user.id);
    if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 });

    const planResult = lessonPlanSchema.safeParse(episode.lesson_plan_json);
    if (!planResult.success) return NextResponse.json({ error: 'Invalid lesson plan' }, { status: 500 });
    const lessonPlan = planResult.data;

    let skillId = episode.skill_id;
    if (!skillId) {
      const { data: skillRow } = await supabase
        .from('skills')
        .select('id')
        .eq('name', episode.skill)
        .limit(1)
        .maybeSingle();
      skillId = (skillRow as { id: string } | null)?.id ?? null;
    }
    if (!skillId) {
      const { data: domain } = await supabase.from('domains').select('id').eq('slug', episode.domain).maybeSingle();
      if (domain) {
        const { data: skillRow } = await supabase
          .from('skills')
          .select('id')
          .eq('domain_id', domain.id)
          .ilike('name', episode.skill)
          .limit(1)
          .maybeSingle();
        skillId = (skillRow as { id: string } | null)?.id ?? null;
      }
    }
    if (!skillId) {
      return NextResponse.json({ error: 'Could not resolve skill for episode' }, { status: 400 });
    }

    const allSkills = await getDomainSkillsOrdered(supabase, episode.domain);
    const domainSkillIds = allSkills.map((s) => s.skill_id);
    const nextSkillIdInCurriculum = getNextSkillIdInCurriculum(allSkills, skillId);

    const now = new Date().toISOString();
    const { data: reviewRows } = await supabase
      .from('review_schedule')
      .select('skill_id')
      .eq('learner_id', user.id)
      .in('skill_id', domainSkillIds)
      .lte('next_review_at', now);
    const dueReviewSkillIds = (reviewRows ?? []).map((r: { skill_id: string }) => r.skill_id);

    const { data: masteryRow } = await supabase
      .from('skill_mastery')
      .select('mastery_probability, confidence_score, attempts_count, spaced_check_count, next_review_at')
      .eq('learner_id', user.id)
      .eq('skill_id', skillId)
      .maybeSingle();

    let masteryBefore: MasterySnapshot | null = null;
    if (masteryRow) {
      const r = masteryRow as {
        mastery_probability: number;
        confidence_score: number;
        attempts_count: number;
        spaced_check_count?: number;
        next_review_at: string | null;
      };
      masteryBefore = {
        skill_id: skillId,
        mastery_probability: r.mastery_probability ?? 0.3,
        confidence_score: r.confidence_score ?? 0,
        attempts_count: r.attempts_count ?? 0,
        spaced_check_count: r.spaced_check_count ?? 0,
        next_review_at: r.next_review_at ?? null,
      };
    }

    const outcome = evaluateLessonCompletion({
      completion,
      lessonPlan,
      masteryBefore,
      skillId,
      skillName: episode.skill,
      domainSkillIds,
      nextSkillIdInCurriculum,
      dueReviewSkillIds,
    });

    await upsertSkillMastery(supabase, user.id, skillId, {
      mastery_probability: outcome.new_mastery_probability,
      confidence_score: outcome.new_confidence_score,
      attempts_count: outcome.new_attempts_count,
      next_review_at: outcome.review_recommendation?.schedule_review ? outcome.next_review_at ?? null : null,
      last_attempt_at: now,
    });

    if (outcome.review_recommendation?.schedule_review && outcome.next_review_at) {
      await upsertReviewSchedule(supabase, user.id, skillId, outcome.next_review_at);
    }

    await insertLearnerLessonHistory(supabase, {
      learner_id: user.id,
      episode_id: episodeId,
      domain: episode.domain,
      skill_id: skillId,
      skill_name: episode.skill,
      promotion_decision: outcome.promotion_decision,
      mastery_before: masteryBefore?.mastery_probability ?? null,
      mastery_after: outcome.new_mastery_probability,
      confidence_before: masteryBefore?.confidence_score ?? null,
      confidence_after: outcome.new_confidence_score,
      next_skill_id: outcome.next_skill_candidate?.skill_id ?? null,
      next_skill_reason: outcome.next_skill_candidate?.reason ?? null,
      next_skill_why: outcome.next_skill_candidate?.why ?? null,
    });

    await updateLessonEpisodeOnComplete(
      supabase,
      episodeId,
      user.id,
      outcome,
      completion.workmat_output ?? null
    );

    // Phase 5: persist learning signals and derive insights
    const rawSignals = completion.learning_signals ?? {};
    const wasReview = dueReviewSkillIds.includes(skillId);
    const fullSignals = learningSignalsSchema.parse({
      ...rawSignals,
      guided_success: completion.guided_try_success,
      independent_success: completion.independent_try_success,
      hint_requests_total: completion.hint_usage_count,
      review_success: wasReview && completion.guided_try_success && completion.independent_try_success,
      first_pass_success: !wasReview && (completion.guided_try_success || completion.independent_try_success),
    });
    await insertLessonSignals(supabase, {
      episode_id: episodeId,
      learner_id: user.id,
      domain: episode.domain,
      skill_id: skillId,
      signals_json: fullSignals,
    });
    const insights = deriveLearnerInsights(fullSignals);
    for (const insight of insights) {
      await upsertLearnerInsight(supabase, {
        learner_id: user.id,
        domain: episode.domain,
        insight_type: insight.insight_type,
        summary_plain_english: insight.summary_plain_english,
        evidence_summary: insight.evidence_summary,
      });
    }

    return NextResponse.json({
      ok: true,
      promotion_decision: outcome.promotion_decision,
      next_skill_candidate: outcome.next_skill_candidate,
    });
  } catch (e) {
    console.error('[instruction/episode/complete]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
