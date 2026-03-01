"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getUserAppRole, getDashboardPath } from "@/lib/auth/getUserAppRole";

export default function V2LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setMessage({ type: "error", text: error.message });
      return;
    }
    const user = data.user;
    if (!user) {
      setLoading(false);
      setMessage({ type: "error", text: "Sign-in succeeded but no user returned." });
      return;
    }
    const appRole = await getUserAppRole(supabase, user);
    setMessage({ type: "ok", text: "Signed in. Redirecting…" });
    window.location.href = getDashboardPath(appRole);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Liv &amp; Elle — Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          No public signup. Use your parent or learner account.
        </p>

        <form onSubmit={handleSignIn} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              autoComplete="current-password"
            />
          </div>
          {message && (
            <p
              className={
                message.type === "error"
                  ? "text-sm text-red-600"
                  : "text-sm text-green-600"
              }
            >
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="underline hover:text-slate-700">
            ← Back to prototype
          </Link>
        </p>
      </div>
    </main>
  );
}
