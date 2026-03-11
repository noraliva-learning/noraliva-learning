'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getUserAppRole, getDashboardPath } from '@/lib/auth/getUserAppRole';
import { getParentViewData, type ChildProgress } from '@/lib/db/getParentViewData';

type TranscriptEntry = {
  id: string;
  learner_id: string;
  session_id: string | null;
  created_at: string;
  helper_name: string;
  role: string;
  content: string;
  input_source: string | null;
  metadata: Record<string, unknown>;
};

export default function ParentTranscriptPage() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildProgress[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const supabase = createClient();

  const loadTranscript = useCallback(async () => {
    setFetching(true);
    try {
      const params = new URLSearchParams();
      if (selectedLearnerId) params.set('learnerId', selectedLearnerId);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const res = await fetch(`/api/v2/transcript?${params.toString()}`);
      if (!res.ok) {
        setTranscript([]);
        return;
      }
      const data = (await res.json()) as { transcript: TranscriptEntry[] };
      setTranscript(data.transcript ?? []);
    } catch {
      setTranscript([]);
    } finally {
      setFetching(false);
    }
  }, [selectedLearnerId, fromDate, toDate]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/v2/login');
        return;
      }
      const appRole = await getUserAppRole(supabase, user);
      if (appRole.role === 'learner') {
        router.replace(getDashboardPath(appRole));
        return;
      }
      try {
        const data = await getParentViewData();
        setChildren(data);
        if (data.length > 0 && !selectedLearnerId) setSelectedLearnerId(data[0].id);
      } catch {
        setChildren([]);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount to load children and set initial learner
  }, [router, supabase]);

  useEffect(() => {
    if (!loading) loadTranscript();
    // Refetch when filters change (loadTranscript already depends on selectedLearnerId, fromDate, toDate)
  }, [loading, loadTranscript]);

  function exportJson() {
    const blob = new Blob([JSON.stringify({ transcript }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tutor-transcript-${fromDate || 'all'}-${toDate || 'all'}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
        <h1 className="text-2xl font-bold text-slate-900">Tutor transcript</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/v2/parent"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-4xl space-y-4">
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">Learner</label>
            <select
              value={selectedLearnerId}
              onChange={(e) => setSelectedLearnerId(e.target.value)}
              className="mt-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name} ({c.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">From date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">To date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={loadTranscript}
            disabled={fetching}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {fetching ? 'Loading…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export JSON
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Messages</h2>
          {transcript.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No transcript entries for this filter.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {transcript.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{new Date(entry.created_at).toLocaleString()}</span>
                    <span>{entry.helper_name}</span>
                    <span className="font-medium">{entry.role}</span>
                    {entry.input_source && <span>({entry.input_source})</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">{entry.content}</p>
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <details className="mt-2 text-xs text-slate-500">
                      <summary>Context</summary>
                      <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
