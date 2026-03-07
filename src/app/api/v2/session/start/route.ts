import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { startSessionBodySchema, startSessionResponseSchema } from '@/lib/session/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = startSessionBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { domain } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data, error } = await supabase
      .from('learning_sessions')
      .insert({
        learner_id: user.id,
        domain,
        status: 'active',
        session_plan: [],
        current_index: 0,
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const response = startSessionResponseSchema.parse({
      sessionId: data.id,
      pathChoices: [
        { id: 'level_up', label: 'Level Up (new)', description: 'Focus on new skills at the edge of learning.' },
        { id: 'review', label: 'Review & Shine', description: 'Reinforce what you know with more review.' },
      ],
      preview: { minQuestions: 6, maxQuestions: 12 },
    });
    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
