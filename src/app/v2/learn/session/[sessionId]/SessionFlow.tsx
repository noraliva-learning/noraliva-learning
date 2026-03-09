'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EndSessionButton } from './SessionActions';
import { SessionQuestion } from './SessionQuestion';

type Props = {
  sessionId: string;
  learnerSlug: string;
  learnerId: string;
};

type Exercise = {
  exerciseId: string | null;
  skillId: string | null;
  prompt: string;
  answer_type: 'number' | 'short_answer' | 'multiple_choice';
  hints: string[];
  index: number;
  debugReason?: string | null;
  debugMessage?: string | null;
  debugCode?: string | null;
} | null;

type Feedback = {
  correct: boolean;
  masteryLevel: number;
  microLesson?: string;
  nextStep: 'next' | 'micro_lesson' | 'end';
  dueReviewsCount?: number;
  encouragementMessage?: string;
};

export function SessionFlow({ sessionId, learnerSlug, learnerId }: Props) {
  const [exercise, setExercise] = useState<Exercise>(null);
  const [status, setStatus] = useState<'loading' | 'question' | 'feedback' | 'celebration' | 'empty'>('loading');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const questionsSeenRef = useRef(0);

  const fetchNext = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/v2/ai/generate-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        setStatus(questionsSeenRef.current > 0 ? 'celebration' : 'empty');
        return;
      }
      const data = await res.json();
      questionsSeenRef.current += 1;
      setExercise({
        exerciseId: data.exerciseId ?? null,
        skillId: data.skillId ?? null,
        prompt: data.prompt,
        answer_type: data.answer_type ?? 'short_answer',
        hints: Array.isArray(data.hints) ? data.hints : [],
        index: questionsSeenRef.current - 1,
        debugReason: data.debugReason ?? null,
        debugMessage: data.debugMessage ?? null,
        debugCode: data.debugCode ?? null,
      });
      setStatus('question');
      setFeedback(null);
    } catch {
      setStatus(questionsSeenRef.current > 0 ? 'celebration' : 'empty');
    }
  }, [sessionId]);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  function handleResult(f: Feedback) {
    setFeedback(f);
    setStatus('feedback');
  }

  function handleAdvance() {
    if (!feedback) return;
    if (feedback.nextStep === 'end') {
      setStatus('celebration');
      setExercise(null);
      return;
    }
    fetchNext();
  }

  if (status === 'loading') {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-slate-600">Getting your question ready…</p>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="mt-6 space-y-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-lg font-semibold text-amber-900">Nothing to practice just yet</p>
          <p className="mt-2 text-slate-700">
            We couldn&apos;t find a question for this topic right now. Try another subject or come back soon!
          </p>
        </div>
        <EndSessionButton sessionId={sessionId} learnerSlug={learnerSlug} />
      </div>
    );
  }

  if (status === 'celebration') {
    return (
      <div className="mt-6 space-y-6">
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-2xl font-bold text-emerald-900">You did it! 🌟</p>
          <p className="mt-2 text-lg font-medium text-emerald-800">Session complete!</p>
          <p className="mt-2 text-slate-700">
            {feedback?.dueReviewsCount != null && feedback.dueReviewsCount > 0
              ? `You have ${feedback.dueReviewsCount} skill(s) to review next time.`
              : 'Awesome work today. Come back anytime for more!'}
          </p>
        </div>
        <EndSessionButton sessionId={sessionId} learnerSlug={learnerSlug} />
      </div>
    );
  }

  if (status === 'feedback' && feedback) {
    return (
      <div className="mt-6 rounded-xl border-2 border-slate-200 bg-slate-50 p-4">
        <p className="text-lg font-semibold text-slate-900">
          {feedback.correct ? 'Nice job! ✓' : 'Good try! Keep going.'}
        </p>
        {feedback.encouragementMessage && (
          <p className="mt-1 text-slate-700">{feedback.encouragementMessage}</p>
        )}
        <p className="mt-1 text-sm text-slate-600">You&apos;re at level {feedback.masteryLevel} on this skill.</p>
        {feedback.microLesson && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Quick tip</p>
            <p className="mt-1">{feedback.microLesson}</p>
          </div>
        )}
        <button
          onClick={handleAdvance}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Next question →
        </button>
      </div>
    );
  }

  if (exercise && (exercise.exerciseId || exercise.prompt)) {
    return (
      <>
        <p className="mt-2 text-sm text-slate-500">
          Question {exercise.index + 1}
        </p>
        <p className="mt-1 text-sm text-slate-600">Give it a try!</p>
        {exercise.exerciseId ? (
          <SessionQuestion
            sessionId={sessionId}
            exerciseId={exercise.exerciseId}
            skillId={exercise.skillId}
            prompt={exercise.prompt}
            answerType={exercise.answer_type}
            hints={exercise.hints}
            onResult={handleResult}
          />
        ) : (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-amber-900">
              This one had a hiccup. Let&apos;s try the next question!
              {(exercise.debugReason || exercise.debugMessage) && (
                <span data-testid="generate-exercise-debug">
                  {' '}[{exercise.debugReason ?? ''}
                  {exercise.debugMessage ? `: ${exercise.debugMessage}` : ''}
                  {exercise.debugCode ? ` (${exercise.debugCode})` : ''}]
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={fetchNext}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Next question →
            </button>
          </div>
        )}
        <div className="mt-6">
          <EndSessionButton sessionId={sessionId} learnerSlug={learnerSlug} />
        </div>
      </>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-slate-600">No questions in this session. Head back and pick another topic!</p>
      <EndSessionButton sessionId={sessionId} learnerSlug={learnerSlug} />
    </div>
  );
}
