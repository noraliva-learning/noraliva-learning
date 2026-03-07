import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePlanBodySchema, generatePlanResponseSchema } from '@/lib/session/schemas';
import { loadSessionPlanData, loadFallbackExerciseIds } from '@/lib/db/loadSessionPlanData';
import { generateSessionPlan } from '@/lib/session/sessionPlanner';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = generatePlanBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { sessionId, path } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: session, error: sessionError } = await supabase
      .from('learning_sessions')
      .select('id, learner_id, domain, status')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessionError || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.learner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (session.status !== 'active') return NextResponse.json({ error: 'Session not active' }, { status: 400 });

    const planData = await loadSessionPlanData(session.domain, user.id);
    let exerciseIds: string[];
    let useFallback = false;

    if (planData && planData.exercises.length > 0) {
      exerciseIds = generateSessionPlan({
        exercises: planData.exercises,
        masteryBySkill: planData.masteryBySkill,
        dueReviewSkillIds: planData.dueReviewSkillIds,
        path,
      });
      if (exerciseIds.length === 0) {
        exerciseIds = await loadFallbackExerciseIds(session.domain, 10, user.id);
        useFallback = true;
      }
    } else {
      exerciseIds = await loadFallbackExerciseIds(session.domain, 10, user.id);
      useFallback = true;
    }

    const sessionPlanPayload = useFallback && exerciseIds.length > 0
      ? exerciseIds.map((id) => ({ id, fallback: true }))
      : exerciseIds;

    await supabase
      .from('learning_sessions')
      .update({
        path,
        session_plan: sessionPlanPayload,
        current_index: 0,
      })
      .eq('id', sessionId)
      .eq('learner_id', user.id);

    const response = generatePlanResponseSchema.parse({
      exerciseIds,
      planLength: exerciseIds.length,
    });
    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
