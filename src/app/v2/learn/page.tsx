"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function V2LearnSessionPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/v2/login");
        return;
      }
      setReady(true);
    })();
  }, [router, supabase]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6">
      <header className="mx-auto flex max-w-4xl items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Learn session (V2)</h1>
        <Link
          href="/v2/parent"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">
          Placeholder: full learn flow will use DB for XP, streak, and progress (replacing localStorage).
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/learners/liv/domains"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open Liv domains (prototype)
          </Link>
          <Link
            href="/learners/elle/domains"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open Elle domains (prototype)
          </Link>
        </div>
      </div>
    </main>
  );
}
