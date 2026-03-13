'use client';

import { useState, useEffect, useRef } from 'react';
import { speak, stopSpeaking } from '@/lib/speech';
import { shouldAutoReadAloud } from '@/lib/learner-theme';
import { JoyfulButton } from '@/components/learner-ui/JoyfulButton';

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
  onAnswerChange?: (value: string) => void;
  onAnswerSubmitted?: (value: string) => void;
  learnerSlug?: 'liv' | 'elle';
};

export function SessionQuestion({
  sessionId,
  exerciseId,
  skillId,
  prompt,
  answerType,
  hints,
  onResult,
  onAnswerChange,
  onAnswerSubmitted,
  learnerSlug = 'liv',
}: Props) {
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintIndex, setHintIndex] = useState(-1);
  const [speechUnavailable, setSpeechUnavailable] = useState(false);
  const promptSpokenRef = useRef(false);

  const autoRead = shouldAutoReadAloud(learnerSlug);

  useEffect(() => {
    if (!prompt?.trim()) return;
    promptSpokenRef.current = false;
    if (!autoRead) return;

    const timer = setTimeout(() => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        setSpeechUnavailable(true);
        return;
      }
      try {
        stopSpeaking();
        speak(prompt, { rate: 0.9, pitch: 1.1 });
        promptSpokenRef.current = true;
      } catch {
        setSpeechUnavailable(true);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      stopSpeaking();
    };
  }, [prompt, autoRead]);

  function handleReplayQuestion() {
    if (!prompt?.trim()) return;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        stopSpeaking();
        speak(prompt, { rate: 0.9, pitch: 1.1 });
      } catch {
        setSpeechUnavailable(true);
      }
    }
  }

  async function handleSubmit() {
    const trimmed = answer.trim();
    if (!trimmed) {
      setError('Type something and try again!');
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
      onAnswerSubmitted?.(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border-2 border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 font-medium text-[rgb(var(--learner-text))]">{prompt}</p>
        <button
          type="button"
          onClick={handleReplayQuestion}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--learner-panel))] text-[rgb(var(--learner-text-muted))] hover:bg-[rgb(var(--learner-accent))] hover:text-[rgb(var(--learner-text))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--learner-cta))]"
          aria-label="Read question again"
          title="Read question again"
        >
          <span aria-hidden>🔊</span>
        </button>
      </div>
      <p className="mt-2 text-sm text-[rgb(var(--learner-text-muted))]">
        Your turn! Type your answer below and we&apos;ll check it together.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {answerType === 'multiple_choice' ? (
          <input
            type="text"
            value={answer}
            onChange={(e) => {
              const value = e.target.value;
              setAnswer(value);
              onAnswerChange?.(value);
            }}
            placeholder="Type your choice"
            className="rounded-lg border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-surface))] px-3 py-2 text-[rgb(var(--learner-text))] placeholder:text-[rgb(var(--learner-text-muted))]"
            disabled={loading}
          />
        ) : (
          <input
            type={answerType === 'number' ? 'text' : 'text'}
            inputMode={answerType === 'number' ? 'numeric' : 'text'}
            value={answer}
            onChange={(e) => {
              const value = e.target.value;
              setAnswer(value);
              onAnswerChange?.(value);
            }}
            placeholder={answerType === 'number' ? 'Enter a number' : 'Type your answer'}
            className="rounded-lg border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-surface))] px-3 py-2 text-[rgb(var(--learner-text))] placeholder:text-[rgb(var(--learner-text-muted))]"
            disabled={loading}
          />
        )}
        <JoyfulButton
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          variant="primary"
        >
          {loading ? 'Checking your answer…' : 'Check my answer'}
        </JoyfulButton>
      </div>
      {loading && (
        <div className="mt-3 rounded-lg bg-[rgb(var(--learner-panel))] px-3 py-2 text-xs text-[rgb(var(--learner-text-muted))]">
          <p>We&apos;re comparing your answer with the goal.</p>
          <p className="mt-0.5">This usually takes just a moment.</p>
        </div>
      )}
      {hints.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setHintIndex((i) => (i < hints.length - 1 ? i + 1 : i))}
            className="text-sm text-[rgb(var(--learner-text-muted))] underline hover:text-[rgb(var(--learner-text))]"
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
