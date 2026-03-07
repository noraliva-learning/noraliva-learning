'use client';

import { useState } from 'react';

type Feedback = {
  correct: boolean;
  masteryLevel: number;
  microLesson?: string;
  nextStep: 'next' | 'micro_lesson' | 'end';
  dueReviewsCount?: number;
  encouragementMessage?: string;
};

type Props = {
  sessionId: string;
  exerciseId: string | null;
  skillId: string | null;
  prompt: string;
  answerType: 'number' | 'short_answer' | 'multiple_choice';
  hints: string[];
  onResult: (f: Feedback) => void;
};

export function SessionQuestion({
  sessionId,
  exerciseId,
  skillId,
  prompt,
  answerType,
  hints,
  onResult,
}: Props) {
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintIndex, setHintIndex] = useState(-1);

  async function handleSubmit() {
    const trimmed = answer.trim();
    if (!trimmed) {
      setError('Please enter an answer.');
      return;
    }
    if (!exerciseId) {
      setError('Exercise not available.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v2/session/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          exerciseId,
          learnerAnswer: trimmed,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      const data = await res.json();
      onResult({
        correct: data.correct,
        masteryLevel: data.masteryLevel,
        microLesson: data.microLesson,
        nextStep: data.nextStep ?? 'next',
        dueReviewsCount: data.dueReviewsCount,
        encouragementMessage: data.encouragementMessage,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
      <p className="font-medium text-slate-900">{prompt}</p>
      <p className="mt-2 text-sm text-slate-600">Your answer:</p>
      <div className="mt-3 flex flex-col gap-3">
        {answerType === 'multiple_choice' ? (
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your choice"
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            disabled={loading}
          />
        ) : (
          <input
            type={answerType === 'number' ? 'text' : 'text'}
            inputMode={answerType === 'number' ? 'numeric' : 'text'}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={answerType === 'number' ? 'Enter a number' : 'Type your answer'}
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            disabled={loading}
          />
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Submit'}
        </button>
      </div>
      {hints.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setHintIndex((i) => (i < hints.length - 1 ? i + 1 : i))}
            className="text-sm text-slate-500 underline hover:text-slate-700"
          >
            {hintIndex < 0 ? 'Show hint' : hintIndex < hints.length - 1 ? 'Show another hint' : 'Hints'}
          </button>
          {hintIndex >= 0 && (
            <p className="mt-1 text-sm text-amber-800">{hints[hintIndex]}</p>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
