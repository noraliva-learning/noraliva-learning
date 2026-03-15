/**
 * Phase 3B: Parent visibility — closed-loop mastery and next-skill data.
 * GET ?learnerId=uuid&domain=math — RLS ensures parent can only access their children.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getClosedLoopView } from '@/lib/db/getClosedLoopView';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const learnerId = searchParams.get('learnerId');
    const domain = searchParams.get('domain') || 'math';

    if (!learnerId) {
      return NextResponse.json({ error: 'learnerId required' }, { status: 400 });
    }

    const view = await getClosedLoopView(supabase, learnerId, domain);
    if (!view) return NextResponse.json({ error: 'Not found or no access' }, { status: 404 });

    return NextResponse.json(view);
  } catch (e) {
    console.error('[parent/closed-loop]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
