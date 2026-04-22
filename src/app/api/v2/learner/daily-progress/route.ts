import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { utcDateString, computeDailyJustMet } from '@/lib/dailyMission/utcDate';

/**
 * POST { markMinimum?: boolean } — after first meaningful practice today, mark daily minimum.
 * Returns dailyMinimumJustMet when this call flipped the flag (for big celebration).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const markMinimum = body?.markMinimum === true;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const missionDate = utcDateString();

    const { data: existing } = await supabase
      .from('learner_daily_mission')
      .select('daily_minimum_met, practice_events')
      .eq('learner_id', user.id)
      .eq('mission_date', missionDate)
      .maybeSingle();

    const beforeMet = !!(existing as { daily_minimum_met?: boolean } | null)?.daily_minimum_met;

    if (!markMinimum) {
      return NextResponse.json({
        dailyMinimumMet: beforeMet,
        dailyMinimumJustMet: false,
        missionDate,
      });
    }

    const prevEvents = (existing as { practice_events?: number } | null)?.practice_events ?? 0;
    const nextEvents = prevEvents + 1;
    const afterMet = true;

    const { error: upsertError } = await supabase.from('learner_daily_mission').upsert(
      {
        learner_id: user.id,
        mission_date: missionDate,
        practice_events: nextEvents,
        daily_minimum_met: afterMet,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'learner_id,mission_date' }
    );

    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

    const justMet = computeDailyJustMet(beforeMet, afterMet);

    return NextResponse.json({
      dailyMinimumMet: afterMet,
      dailyMinimumJustMet: justMet,
      missionDate,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
