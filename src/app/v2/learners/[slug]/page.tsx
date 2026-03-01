"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserAppRole, getDashboardPath } from "@/lib/auth/getUserAppRole";

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

  if (!ready || !isSlug(slug)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  const name = slug === "liv" ? "Liv" : "Elle";

  return (
    <main className="min-h-screen p-6">
      <header className="mx-auto flex max-w-4xl items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Learner Dashboard ({name})</h1>
        <button
          onClick={handleSignOut}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Sign out
        </button>
      </header>

      <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">Choose a domain to practice.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {DOMAINS.map((d) => (
            <Link
              key={d.id}
              href={`/learners/${slug}/domains/${d.id}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <div className="font-semibold text-slate-900">{d.label}</div>
              <div className="mt-1 text-sm text-slate-600">Start a session</div>
            </Link>
          ))}
        </div>
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
      </div>
    </main>
  );
}
