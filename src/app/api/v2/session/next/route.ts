import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getNextQuerySchema, getNextResponseSchema } from '@/lib/session/schemas';
import { getSessionPlanIds } from '@/lib/session/sessionPlanUtils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = getNextQuerySchema.safeParse({ sessionId: searchParams.get('sessionId') });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing or invalid sessionId' }, { status: 400 });
    }
    const { sessionId } = parsed.data;

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
    const index = (session.current_index as number) ?? 0;
    if (index >= plan.length) {
      return new NextResponse(null, { status: 204 });
    }
    const exerciseId = plan[index];
    const { data: ex, error: exError } = await supabase
      .from('exercises')
      .select('id, prompt')
      .eq('id', exerciseId)
      .single();
    if (exError || !ex) return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });

    const response = getNextResponseSchema.parse({
      exerciseId: ex.id,
      prompt: ex.prompt,
      index,
      total: plan.length,
    });
    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
