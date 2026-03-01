'use client';

import Link from 'next/link';
import { useState } from 'react';
import { submitAnswer } from '@/lib/db/submitAnswer';

type Props = {
  exerciseId: string;
  prompt: string;
  sessionId: string;
  domainSlug: string;
};

export function SessionQuestion({ exerciseId, prompt, sessionId, domainSlug }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; masteryLevel: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnswer(correct: boolean) {
    setLoading(true);
    setError(null);
    try {
      const { masteryLevel } = await submitAnswer(exerciseId, correct);
      setResult({ correct, masteryLevel });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setLoading(false);
    }
  }

  if (submitted && result) {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="font-medium text-slate-900">
          {result.correct ? 'Correct!' : 'Not quite.'}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Mastery level for this skill: {result.masteryLevel}
        </p>
        <Link
          href={`/v2/learn/session/${sessionId}?lastExerciseId=${encodeURIComponent(exerciseId)}`}
          className="mt-3 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Next question
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
      <p className="font-medium text-slate-900">{prompt}</p>
      <p className="mt-2 text-sm text-slate-600">Choose your answer:</p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => handleAnswer(true)}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => handleAnswer(false)}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          5
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
