"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserAppRole, getDashboardPath } from "@/lib/auth/getUserAppRole";
import { getParentViewData, type ChildProgress } from "@/lib/db/getParentViewData";
import type { Profile } from "@/lib/supabase/types";

export default function V2ParentDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<ChildProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/v2/login");
        return;
      }
      const appRole = await getUserAppRole(supabase, user);
      if (appRole.role === "learner") {
        router.replace(getDashboardPath(appRole));
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(p ?? null);
      try {
        const data = await getParentViewData();
        setProgress(data);
      } catch {
        setProgress([]);
      }
      setLoading(false);
    })();
  }, [router, supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/v2/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6">
      <header className="mx-auto flex max-w-4xl items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Parent Dashboard (V2)</h1>
        <div className="flex items-center gap-3">
          {profile && (
            <span className="text-sm text-slate-600">
              {profile.display_name} ({profile.role})
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">
          Placeholder: manage learners (Liv / Elle), view progress, and start learn sessions.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/v2/learn"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Go to Learn session
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to prototype home
          </Link>
        </div>

        {progress.length > 0 && (
          <div className="mt-8 space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Learner progress</h2>
            {progress.map((child) => (
              <div key={child.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-medium text-slate-900">{child.display_name} ({child.role})</h3>
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-slate-600">Attempts</h4>
                  {child.attempts.length === 0 ? (
                    <p className="text-sm text-slate-500">No attempts yet.</p>
                  ) : (
                    <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
                      {child.attempts.slice(0, 10).map((a) => (
                        <li key={a.id}>
                          {a.prompt} — {a.correct ? "Correct" : "Incorrect"} ({new Date(a.created_at).toLocaleString()})
                        </li>
                      ))}
                      {child.attempts.length > 10 && <li>… and {child.attempts.length - 10} more</li>}
                    </ul>
                  )}
                </div>
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-slate-600">Skill mastery</h4>
                  {child.mastery.length === 0 ? (
                    <p className="text-sm text-slate-500">No mastery data yet.</p>
                  ) : (
                    <ul className="mt-1 text-sm text-slate-700">
                      {child.mastery.map((m, i) => (
                        <li key={i}>{m.skill_name}: level {m.level}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
