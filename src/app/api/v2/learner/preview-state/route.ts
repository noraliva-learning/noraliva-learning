import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { utcDateString } from '@/lib/dailyMission/utcDate';

/**
 * GET — buddy, grade label, today's daily mission row (for learner home).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('buddy_slug, grade_label, age, display_name, role')
      .eq('id', user.id)
      .single();

    const missionDate = utcDateString();
    const { data: daily } = await supabase
      .from('learner_daily_mission')
      .select('daily_minimum_met, practice_events')
      .eq('learner_id', user.id)
      .eq('mission_date', missionDate)
      .maybeSingle();

    return NextResponse.json({
      buddySlug: (profile as { buddy_slug?: string | null })?.buddy_slug ?? null,
      gradeLabel: (profile as { grade_label?: string | null })?.grade_label ?? null,
      age: (profile as { age?: number | null })?.age ?? null,
      missionDate,
      dailyMinimumMet: !!(daily as { daily_minimum_met?: boolean } | null)?.daily_minimum_met,
      practiceEventsToday: (daily as { practice_events?: number } | null)?.practice_events ?? 0,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server error' },
      { status: 500 }
    );
  }
}
