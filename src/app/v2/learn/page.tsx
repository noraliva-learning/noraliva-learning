'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function V2LearnPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState('math');
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/v2/login');
        return;
      }
      setReady(true);
    })();
  }, [router, supabase]);

  async function handleStartSession() {
    setError(null);
    setStarting(true);
    try {
      const res = await fetch('/api/v2/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      const data = await res.json();
      router.push(`/v2/learn/session/${data.sessionId}`);
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start session');
    } finally {
      setStarting(false);
    }
  }

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
        <h1 className="text-2xl font-bold text-slate-900">Learn (V2)</h1>
        <Link
          href="/v2/parent"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="mx-auto mt-8 max-w-4xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">
            Start a short adaptive session. Ace will generate exercises at the edge of your ability.
          </p>
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700">Domain</label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="ml-2 rounded border border-slate-300 px-2 py-1 text-slate-800"
              >
                <option value="math">Math</option>
                <option value="reading">Reading</option>
                <option value="writing">Writing</option>
                <option value="architecture">Architecture</option>
                <option value="spanish">Spanish</option>
              </select>
            </div>
            <button
              onClick={handleStartSession}
              disabled={starting}
              className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {starting ? 'Starting…' : 'Start session'}
            </button>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
      </div>
    </main>
  );
}
