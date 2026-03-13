"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserAppRole, getDashboardPath } from "@/lib/auth/getUserAppRole";
import { startLearningSession } from "@/lib/db/startSession";
import { LearnerTheme } from "@/components/learner-theme/LearnerTheme";
import { CompanionElle, CompanionLiv } from "@/components/learner-companions";
import { JoyfulButton } from "@/components/learner-ui/JoyfulButton";

const DOMAINS = [
  { id: "math", label: "Math" },
  { id: "reading", label: "Reading" },
  { id: "writing", label: "Writing" },
  { id: "architecture", label: "Architecture" },
  { id: "spanish", label: "Spanish" },
];

const VALID_SLUGS = ["liv", "elle"] as const;
type Slug = (typeof VALID_SLUGS)[number];

function isSlug(s: string | undefined): s is Slug {
  return s !== undefined && VALID_SLUGS.includes(s as Slug);
}

export default function V2LearnerDashboardPage() {
  const params = useParams();
  const slug = params.slug as string | undefined;
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [startingDomain, setStartingDomain] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!isSlug(slug)) {
      if (slug !== undefined) router.replace("/v2/login");
      return;
    }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/v2/login");
        return;
      }
      const appRole = await getUserAppRole(supabase, user);
      if (appRole.role === "parent") {
        router.replace("/v2/parent");
        return;
      }
      if (appRole.learnerSlug !== slug) {
        router.replace(getDashboardPath(appRole));
        return;
      }
      setReady(true);
    })();
  }, [slug, router, supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/v2/login");
  }

  async function handleStartSession(domain: string) {
    if (!isSlug(slug)) return;
    setStartingDomain(domain);
    try {
      const { sessionId } = await startLearningSession(domain);
      router.push(`/v2/learn/session/${sessionId}`);
    } catch (e) {
      console.error(e);
      setStartingDomain(null);
    }
  }

  if (!ready || !isSlug(slug)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  const name = slug === "liv" ? "Liv" : "Elle";
  const Companion = slug === "elle" ? CompanionElle : CompanionLiv;

  return (
    <LearnerTheme learnerSlug={slug}>
      <main className="min-h-screen p-6">
        <header className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Companion size={36} className="shrink-0" />
            <h1 className="text-2xl font-bold text-[rgb(var(--learner-text))]">Hi, {name}!</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-[rgb(var(--learner-border))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--learner-text))] hover:bg-[rgb(var(--learner-bg-subtle))]"
          >
            Sign out
          </button>
        </header>

        <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-6 shadow-sm">
          <p className="text-[rgb(var(--learner-text-muted))]">Choose what you want to practice today.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {DOMAINS.map((d) => (
              <JoyfulButton
                key={d.id}
                type="button"
                onClick={() => handleStartSession(d.id)}
                disabled={startingDomain !== null}
                variant="secondary"
                className="w-full rounded-xl p-4 text-left"
              >
                <div className="font-semibold">{d.label}</div>
                <div className="mt-1 text-sm opacity-90">
                  {startingDomain === d.id ? "Starting…" : "Tap to start →"}
                </div>
              </JoyfulButton>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <JoyfulButton
              type="button"
              onClick={() => handleStartSession("math")}
              disabled={startingDomain !== null}
              variant="primary"
            >
              {startingDomain === "math" ? "Starting…" : "Quick start: Math"}
            </JoyfulButton>
            <Link
              href="/"
              className="rounded-lg border border-[rgb(var(--learner-border))] px-4 py-2 text-sm font-semibold text-[rgb(var(--learner-text))] hover:bg-[rgb(var(--learner-bg-subtle))]"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>
    </LearnerTheme>
  );
}
