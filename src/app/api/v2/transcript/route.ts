import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/v2/transcript
 * Query: learnerId (optional), from (ISO date), to (ISO date).
 * Auth: parent sees only their children's transcripts; learner sees only their own.
 * Returns chronological transcript entries (export-ready).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const learnerIdParam = searchParams.get('learnerId');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  // Resolve which learner IDs the user can access
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, parent_id')
    .eq('id', user.id)
    .maybeSingle();

  const role = (profile as { role?: string } | null)?.role;
  let allowedLearnerIds: string[];

  if (role === 'parent') {
    const { data: children } = await supabase
      .from('profiles')
      .select('id')
      .eq('parent_id', user.id);
    allowedLearnerIds = (children ?? []).map((c) => c.id);
  } else if (role === 'liv' || role === 'elle') {
    allowedLearnerIds = [user.id];
  } else {
    allowedLearnerIds = [user.id];
  }

  if (allowedLearnerIds.length === 0) {
    return NextResponse.json({ transcript: [] });
  }

  // Optional filter to one learner (parent selecting a child)
  const learnerIds =
    learnerIdParam && allowedLearnerIds.includes(learnerIdParam)
      ? [learnerIdParam]
      : allowedLearnerIds;

  let query = supabase
    .from('tutor_transcript')
    .select('id, learner_id, session_id, created_at, helper_name, role, content, input_source, metadata')
    .in('learner_id', learnerIds)
    .order('created_at', { ascending: true });

  if (fromParam) {
    const fromDate = new Date(fromParam);
    if (!Number.isNaN(fromDate.getTime())) {
      query = query.gte('created_at', fromDate.toISOString());
    }
  }
  if (toParam) {
    const toDate = new Date(toParam);
    if (!Number.isNaN(toDate.getTime())) {
      query = query.lte('created_at', toDate.toISOString());
    }
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error('[transcript] query error', error.message);
    return NextResponse.json({ error: 'Failed to load transcript' }, { status: 500 });
  }

  const transcript = (rows ?? []).map((r) => ({
    id: r.id,
    learner_id: r.learner_id,
    session_id: r.session_id,
    created_at: r.created_at,
    helper_name: r.helper_name,
    role: r.role,
    content: r.content,
    input_source: r.input_source ?? null,
    metadata: r.metadata ?? {},
  }));

  return NextResponse.json({ transcript });
}
