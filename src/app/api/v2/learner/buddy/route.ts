import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isBuddySlug } from '@/lib/buddy/buddyTypes';

/**
 * POST { buddySlug } — persist child-selected buddy on own profile.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const buddySlug = body?.buddySlug;
    if (!isBuddySlug(buddySlug)) {
      return NextResponse.json({ error: 'Invalid buddySlug' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { error } = await supabase.from('profiles').update({ buddy_slug: buddySlug }).eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, buddySlug });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
