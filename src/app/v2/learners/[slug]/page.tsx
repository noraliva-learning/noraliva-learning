"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserAppRole, getDashboardPath } from "@/lib/auth/getUserAppRole";
import { startLearningSession } from "@/lib/db/startSession";
import { LearnerTheme } from "@/components/learner-theme/LearnerTheme";
import { JoyfulButton } from "@/components/learner-ui/JoyfulButton";
import { WorldBackground } from "@/components/phase8/WorldBackground";
import { BuddyPicker } from "@/components/phase8/BuddyPicker";
import { GamesComingSoon } from "@/components/phase8/GamesComingSoon";
import { getLearnerProfile } from "@/lib/learners";
import type { BuddySlug } from "@/lib/supabase/types";
import { BuddyAvatar } from "@/components/phase8/BuddyAvatar";

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

type PreviewState = {
  buddySlug: BuddySlug | null;
  gradeLabel: string | null;
  age: number | null;
  missionDate: string;
  dailyMinimumMet: boolean;
  practiceEventsToday: number;
};

export default function V2LearnerDashboardPage() {
  const params = useParams();
  const slug = params.slug as string | undefined;
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [startingDomain, setStartingDomain] = useState<string | null>(null);
  const [startingLesson, setStartingLesson] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [buddySaving, setBuddySaving] = useState(false);
  const [localBuddy, setLocalBuddy] = useState<BuddySlug | null>(null);
  const supabase = createClient();

  const loadPreview = useCallback(async () => {
    const res = await fetch("/api/v2/learner/preview-state");
    if (!res.ok) return;
    const data = await res.json();
    setPreview({
      buddySlug: data.buddySlug ?? null,
      gradeLabel: data.gradeLabel ?? null,
      age: data.age ?? null,
      missionDate: data.missionDate,
      dailyMinimumMet: !!data.dailyMinimumMet,
      practiceEventsToday: data.practiceEventsToday ?? 0,
    });
    setLocalBuddy(data.buddySlug ?? null);
  }, []);

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
      await loadPreview();
      setReady(true);
    })();
  }, [slug, router, supabase, loadPreview]);

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

  async function handleBuddySelect(next: BuddySlug) {
    setLocalBuddy(next);
    setBuddySaving(true);
    try {
      const res = await fetch("/api/v2/learner/buddy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buddySlug: next }),
      });
      if (res.ok) {
        setPreview((p) => (p ? { ...p, buddySlug: next } : p));
      }
    } finally {
      setBuddySaving(false);
    }
  }

  async function handleStartAceLesson(domain: "math" | "reading") {
    if (!isSlug(slug)) return;
    setStartingLesson(true);
    try {
      const res = await fetch("/api/v2/instruction/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, learnerSlug: slug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      const data = await res.json();
      const episodeId = data.episodeId;
      if (episodeId) router.push(`/v2/learn/lesson/${episodeId}`);
      else setStartingLesson(false);
    } catch (e) {
      console.error(e);
      setStartingLesson(false);
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
  const fallback = getLearnerProfile(slug);
  const gradeDisplay = preview?.gradeLabel?.trim() || fallback.gradeLabel;
  const ageDisplay = preview?.age ?? fallback.age;
  const buddyForDisplay = localBuddy ?? preview?.buddySlug ?? null;

  return (
    <WorldBackground learnerSlug={slug}>
      <LearnerTheme learnerSlug={slug} transparentSurface>
        <main className="min-h-screen p-6" data-testid="learner-home">
          <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BuddyAvatar buddySlug={buddyForDisplay} state="idle" size="sm" />
              <div>
                <h1 className="text-2xl font-bold text-[rgb(var(--learner-text))]">Hi, {name}!</h1>
                <p className="text-sm text-[rgb(var(--learner-text-muted))]" data-testid="learner-grade-badge">
                  {gradeDisplay} · age {ageDisplay}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-[rgb(var(--learner-border))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--learner-text))] hover:bg-[rgb(var(--learner-bg-subtle))]"
            >
              Sign out
            </button>
          </header>

          <div className="mx-auto mt-8 max-w-4xl space-y-8">
            <section
              className="rounded-2xl border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))]/95 p-6 shadow-sm backdrop-blur-sm"
              data-testid="daily-mission-card"
            >
              <h2 className="text-lg font-bold text-[rgb(var(--learner-text))]">Your daily mission</h2>
              <p className="mt-1 text-[rgb(var(--learner-text-muted))]">Do at least 1 practice today. You can always do more.</p>
              <div className="mt-4 flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
                    preview?.dailyMinimumMet
                      ? "bg-emerald-200 text-emerald-900"
                      : "bg-[rgb(var(--learner-panel))] text-[rgb(var(--learner-text-muted))]"
                  }`}
                  data-testid="daily-mission-icon"
                >
                  {preview?.dailyMinimumMet ? "✓" : "1"}
                </div>
                <div>
                  <p className="font-semibold text-[rgb(var(--learner-text))]">
                    {preview?.dailyMinimumMet ? "You did your daily goal today!" : "Goal: finish 1 practice"}
                  </p>
                  <p className="text-xs text-[rgb(var(--learner-text-muted))]">
                    {preview?.dailyMinimumMet
                      ? "Come back tomorrow for a fresh start."
                      : "Tap Math or Reading below to begin."}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))]/95 p-6 shadow-sm backdrop-blur-sm">
              <BuddyPicker selected={localBuddy} onSelect={handleBuddySelect} disabled={buddySaving} />
            </section>

            <section className="rounded-2xl border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))]/95 p-6 shadow-sm backdrop-blur-sm">
              <h2 className="text-lg font-bold text-[rgb(var(--learner-text))]">Lessons</h2>
              <p className="mt-1 text-[rgb(var(--learner-text-muted))]">Choose what you want to practice.</p>
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
                  onClick={() => handleStartAceLesson("math")}
                  disabled={startingLesson || startingDomain !== null}
                  variant="primary"
                >
                  {startingLesson ? "Starting lesson…" : "Ace Lesson: Math"}
                </JoyfulButton>
                <JoyfulButton
                  type="button"
                  onClick={() => handleStartAceLesson("reading")}
                  disabled={startingLesson || startingDomain !== null}
                  variant="primary"
                >
                  {startingLesson ? "Starting lesson…" : "Ace Lesson: Reading"}
                </JoyfulButton>
                <JoyfulButton
                  type="button"
                  onClick={() => handleStartSession("math")}
                  disabled={startingDomain !== null || startingLesson}
                  variant="secondary"
                >
                  {startingDomain === "math" ? "Starting…" : "Practice (quiz): Math"}
                </JoyfulButton>
                <Link
                  href="/"
                  className="rounded-lg border border-[rgb(var(--learner-border))] px-4 py-2 text-sm font-semibold text-[rgb(var(--learner-text))] hover:bg-[rgb(var(--learner-bg-subtle))]"
                >
                  Back to home
                </Link>
              </div>
            </section>

            <GamesComingSoon />
          </div>
        </main>
      </LearnerTheme>
    </WorldBackground>
  );
}
