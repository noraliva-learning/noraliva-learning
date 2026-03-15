'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ClosedLoopView } from '@/lib/db/getClosedLoopView';

type Child = { id: string; display_name: string; role: string };

type Props = {
  children: Child[];
};

export function ParentInsightView({ children }: Props) {
  const searchParams = useSearchParams();
  const learnerIdParam = searchParams.get('learnerId');
  const [selectedId, setSelectedId] = useState<string | null>(learnerIdParam || children[0]?.id || null);
  const [data, setData] = useState<ClosedLoopView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [domain, setDomain] = useState<'math' | 'reading'>('math');

  const fetchClosedLoop = useCallback(
    async (learnerId: string, dom: 'math' | 'reading') => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v2/parent/closed-loop?learnerId=${encodeURIComponent(learnerId)}&domain=${dom}`
        );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.error || res.statusText);
        setData(null);
        return;
      }
      const view = (await res.json()) as ClosedLoopView;
      setData(view);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  },
    []
  );

  useEffect(() => {
    if (selectedId) fetchClosedLoop(selectedId, domain);
    else setData(null);
  }, [selectedId, domain, fetchClosedLoop]);

  if (!children.length) {
    return (
      <main className="min-h-screen p-6">
        <p className="text-slate-600">No learners linked to your account.</p>
        <Link href="/v2/parent" className="mt-4 inline-block text-slate-700 underline">
          Back to parent dashboard
        </Link>
      </main>
    );
  }

  const selectedChild = children.find((c) => c.id === selectedId) ?? children[0];

  return (
    <>
      <header className="mx-auto flex max-w-4xl items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Learning insight</h1>
        <Link
          href="/v2/parent"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Back to dashboard
        </Link>
      </header>

      <div className="mx-auto mt-6 max-w-4xl">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label htmlFor="learner" className="text-sm font-medium text-slate-700">
            Learner:
          </label>
          <select
            id="learner"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value || null)}
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
          <label htmlFor="domain" className="text-sm font-medium text-slate-700">
            Domain:
          </label>
          <select
            id="domain"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            value={domain}
            onChange={(e) => setDomain(e.target.value as 'math' | 'reading')}
          >
            <option value="math">Math</option>
            <option value="reading">Reading</option>
          </select>
        </div>

        {loading && <p className="text-slate-600">Loading…</p>}
        {error && <p className="text-red-600">{error}</p>}
        {data && !loading && (
          <div className="space-y-8">
            {data.learner_insights && data.learner_insights.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">How {selectedChild?.display_name} learns</h2>
                <ul className="mt-3 space-y-2">
                  {data.learner_insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-700">
                      <span className="text-slate-400">•</span>
                      <span>{insight.summary_plain_english}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Mastery (math)</h2>
              {data.mastery_by_skill.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No mastery data yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.mastery_by_skill.map((m) => (
                    <li key={m.skill_id} className="flex justify-between text-sm">
                      <span className="text-slate-700">{m.skill_name}</span>
                      <span className="text-slate-600">
                        {Math.round(m.mastery_probability * 100)}% · {m.attempts_count} attempts
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data.latest_lesson_decision && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Latest lesson</h2>
                <p className="mt-2 text-sm text-slate-700">
                  <strong>{data.latest_lesson_decision.skill_name}</strong> — decision:{' '}
                  {data.latest_lesson_decision.promotion_decision}
                  {data.latest_lesson_decision.mastery_before != null && data.latest_lesson_decision.mastery_after != null && (
                    <> · mastery {Math.round(data.latest_lesson_decision.mastery_before * 100)}% → {Math.round(data.latest_lesson_decision.mastery_after * 100)}%</>
                  )}
                </p>
                {data.latest_lesson_decision.why_this_lesson_summary && (
                  <p className="mt-2 text-sm text-slate-600 italic">
                    Why this lesson: {data.latest_lesson_decision.why_this_lesson_summary}
                  </p>
                )}
              </section>
            )}

            {data.next_planned_skill && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Next planned skill</h2>
                <p className="mt-2 text-sm text-slate-700">
                  {data.next_planned_skill.skill_name} — {data.next_planned_skill.reason}
                  {data.next_planned_skill.why && ` (${data.next_planned_skill.why})`}
                </p>
              </section>
            )}

            {data.scheduled_reviews.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Scheduled reviews</h2>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {data.scheduled_reviews.map((r) => (
                    <li key={r.skill_id}>
                      {r.skill_name} — {new Date(r.next_review_at).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.recent_misconceptions.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Recent misconceptions</h2>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {data.recent_misconceptions.map((m, i) => (
                    <li key={i}>{m.tag}</li>
                  ))}
                </ul>
              </section>
            )}

            {data.recent_episodes_for_review && data.recent_episodes_for_review.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Recent lessons</h2>
                <ul className="mt-3 space-y-3">
                  {data.recent_episodes_for_review.slice(0, 5).map((ep) => (
                    <li key={ep.episode_id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                      <div className="font-medium text-slate-800">{ep.skill_name}</div>
                      <div className="mt-1 text-slate-600">
                        {ep.completion_status} · {ep.promotion_decision ?? '—'}
                        {ep.workmat_used && (
                          <> · Work Mat used{ep.workmat_validation_valid != null && (ep.workmat_validation_valid ? ' · validation passed' : ' · validation not passed')}</>
                        )}
                      </div>
                      <div className="mt-1 text-slate-500">{new Date(ep.created_at).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}
