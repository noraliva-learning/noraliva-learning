import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { submitAttemptBodySchema, submitAttemptResponseSchema } from '@/lib/session/schemas';
import { submitAttemptForSession } from '@/lib/db/submitAttemptForSession';
import { getSessionPlanIds } from '@/lib/session/sessionPlanUtils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = submitAttemptBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { sessionId, exerciseId, correct, masteryDelta, misconceptionTag } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: session, error: sessionError } = await supabase
      .from('learning_sessions')
      .select('id, learner_id, session_plan, current_index')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessionError || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.learner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const plan = getSessionPlanIds(session.session_plan);
    const currentIndex = (session.current_index as number) ?? 0;
    const aiMode = plan.length === 0;

    if (!aiMode && plan[currentIndex] !== exerciseId) {
      return NextResponse.json({ error: 'Exercise does not match current session step' }, { status: 400 });
    }

    const result = await submitAttemptForSession(sessionId, exerciseId, correct, aiMode ? {
      masteryDelta: masteryDelta ?? undefined,
      misconceptionTag: misconceptionTag ?? undefined,
    } : undefined);

    const newIndex = aiMode ? currentIndex : currentIndex + 1;
    if (!aiMode) {
      await supabase
        .from('learning_sessions')
        .update({ current_index: newIndex })
        .eq('id', sessionId)
        .eq('learner_id', user.id);
    }

    const atEnd = !aiMode && newIndex >= plan.length;
    let nextStep: 'next' | 'micro_lesson' | 'end' = atEnd ? 'end' : result.struggleDetected ? 'micro_lesson' : 'next';

    let exerciseIdNext: string | undefined;
    let promptNext: string | undefined;
    if (nextStep === 'next' && !atEnd && plan[newIndex]) {
      const { data: ex } = await supabase
        .from('exercises')
        .select('id, prompt')
        .eq('id', plan[newIndex])
        .single();
      if (ex) {
        exerciseIdNext = ex.id;
        promptNext = ex.prompt;
      }
    }
    if (nextStep === 'micro_lesson' && atEnd) nextStep = 'end';

    const dueRows = await supabase
      .from('review_schedule')
      .select('skill_id')
      .eq('learner_id', user.id)
      .lte('next_review_at', new Date().toISOString());
    const dueReviewsCount = dueRows.data?.length ?? 0;

    const response = submitAttemptResponseSchema.parse({
      nextStep,
      masteryLevel: result.masteryLevel,
      exerciseId: exerciseIdNext,
      prompt: promptNext,
      microLesson: result.microLesson,
      dueReviewsCount: dueReviewsCount > 0 ? dueReviewsCount : undefined,
      index: aiMode ? undefined : newIndex,
      total: aiMode ? undefined : plan.length,
    });
    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
