/**
 * Phase 2A: DB persistence for XP, streak, challenge day.
 * Use this in V2 learn flow instead of localStorage.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type XpStreakState = {
  xp: number;
  streak: number;
  challengeDay: number;
  committed: boolean;
  lastCompletedDate?: string | null;
};

const DEFAULT_STATE: XpStreakState = {
  xp: 0,
  streak: 0,
  challengeDay: 0,
  committed: false,
  lastCompletedDate: null,
};

export async function getXpStreak(
  supabase: SupabaseClient,
  learnerId: string,
  domainId: string
): Promise<XpStreakState> {
  const { data, error } = await supabase
    .from("xp_streaks")
    .select("xp, streak, challenge_day, last_completed_date, committed")
    .eq("learner_id", learnerId)
    .eq("domain_id", domainId)
    .maybeSingle();

  if (error) {
    console.error("[getXpStreak]", error);
    return DEFAULT_STATE;
  }
  if (!data) return DEFAULT_STATE;

  return {
    xp: data.xp ?? 0,
    streak: data.streak ?? 0,
    challengeDay: data.challenge_day ?? 0,
    committed: data.committed ?? false,
    lastCompletedDate: data.last_completed_date ?? null,
  };
}

/** Resolve domain_id from slug: xp_streaks.domain_id is UUID (FK to domains). */
async function getDomainIdBySlug(
  supabase: SupabaseClient,
  domainSlug: string
): Promise<string | null> {
  const { data } = await supabase
    .from("domains")
    .select("id")
    .eq("slug", domainSlug)
    .single();
  return data?.id ?? null;
}

export async function getXpStreakBySlug(
  supabase: SupabaseClient,
  learnerId: string,
  domainSlug: string
): Promise<XpStreakState> {
  const domainId = await getDomainIdBySlug(supabase, domainSlug);
  if (!domainId) return DEFAULT_STATE;
  return getXpStreak(supabase, learnerId, domainId);
}

export async function upsertXpStreak(
  supabase: SupabaseClient,
  learnerId: string,
  domainSlug: string,
  state: XpStreakState
): Promise<{ error: Error | null }> {
  const domainId = await getDomainIdBySlug(supabase, domainSlug);
  if (!domainId) {
    return { error: new Error("Domain not found: " + domainSlug) };
  }

  const { error } = await supabase.from("xp_streaks").upsert(
    {
      learner_id: learnerId,
      domain_id: domainId,
      xp: state.xp,
      streak: state.streak,
      challenge_day: state.challengeDay,
      last_completed_date: state.lastCompletedDate || null,
      committed: state.committed,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "learner_id,domain_id",
    }
  );

  if (error) {
    console.error("[upsertXpStreak]", error);
    return { error };
  }
  return { error: null };
}
