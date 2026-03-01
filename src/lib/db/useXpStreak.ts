"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getXpStreakBySlug,
  upsertXpStreak,
  type XpStreakState,
} from "./xp-streak";

/**
 * V2: Load and persist XP/streak to DB for the given learner and domain.
 * Use when learnerId is the auth user's UUID (learner profile id).
 */
export function useXpStreak(learnerId: string | null, domainSlug: string | null) {
  const [state, setState] = useState<XpStreakState>({
    xp: 0,
    streak: 0,
    challengeDay: 0,
    committed: false,
    lastCompletedDate: null,
  });
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!learnerId || !domainSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const loaded = await getXpStreakBySlug(supabase, learnerId, domainSlug);
      if (!cancelled) {
        setState(loaded);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [learnerId, domainSlug, supabase]);

  const save = useCallback(
    async (next: XpStreakState) => {
      if (!learnerId || !domainSlug) return;
      setState(next);
      const { error } = await upsertXpStreak(supabase, learnerId, domainSlug, next);
      setSaveError(error ?? null);
    },
    [learnerId, domainSlug, supabase]
  );

  return { state, setState, save, loading, saveError };
}
