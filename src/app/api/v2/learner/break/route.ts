import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST { sessionId?: string } — record "I need a break" (no penalty; parent can see).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: row, error } = await supabase
      .from('learner_events')
      .insert({
        learner_id: user.id,
        session_id: sessionId,
        event_type: 'break_request',
        metadata: {},
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, eventId: row?.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
