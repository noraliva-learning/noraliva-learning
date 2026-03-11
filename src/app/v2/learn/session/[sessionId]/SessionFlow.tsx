'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EndSessionButton } from './SessionActions';
import { SessionQuestion } from './SessionQuestion';
import { AceChatPanel } from './AceChatPanel';

type Props = {
  sessionId: string;
  learnerSlug: string;
  learnerId: string;
  learnerName: string;
  domain: string;
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

export function SessionFlow({ sessionId, learnerSlug, learnerId, learnerName, domain }: Props) {
  const [exercise, setExercise] = useState<Exercise>(null);
  const [prefetchedExercise, setPrefetchedExercise] = useState<Exercise>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [status, setStatus] = useState<'loading' | 'question' | 'feedback' | 'celebration' | 'empty'>('loading');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const questionsSeenRef = useRef(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [latestAnswer, setLatestAnswer] = useState<string | null>(null);

  const helperName = 'Ace';

  const missionTarget = 8;

  const buildExercise = (data: any, index: number): Exercise => ({
    exerciseId: data.exerciseId ?? null,
    skillId: data.skillId ?? null,
    prompt: data.prompt,
    answer_type: data.answer_type ?? 'short_answer',
    hints: Array.isArray(data.hints) ? data.hints : [],
    index,
    debugReason: data.debugReason ?? null,
    debugMessage: data.debugMessage ?? null,
    debugCode: data.debugCode ?? null,
  });

  const fetchNext = useCallback(async () => {
    setStatus('loading');
    setFeedback(null);
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
      const nextIndex = questionsSeenRef.current;
      const nextExercise = buildExercise(data, nextIndex);
      questionsSeenRef.current = nextIndex + 1;
      setExercise(nextExercise);
      setPrefetchedExercise(null);
      setStatus('question');
    } catch {
      setStatus(questionsSeenRef.current > 0 ? 'celebration' : 'empty');
    }
  }, [sessionId]);

  const prefetchNext = useCallback(async () => {
    if (isPrefetching || prefetchedExercise) return;
    setIsPrefetching(true);
    try {
      const res = await fetch('/api/v2/ai/generate-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const nextIndex = questionsSeenRef.current;
      const nextExercise = buildExercise(data, nextIndex);
      setPrefetchedExercise(nextExercise);
    } catch {
      // Background fetch failures should not break the current flow.
    } finally {
      setIsPrefetching(false);
    }
  }, [isPrefetching, prefetchedExercise, sessionId]);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  function handleResult(f: Feedback) {
    setFeedback(f);
    setLatestAnswer(null);
    setCompletedCount((count) => count + 1);
    if (f.nextStep === 'next') {
      prefetchNext();
    }
    setStatus('feedback');
  }

  function handleAdvance() {
    if (!feedback) return;
    if (feedback.nextStep === 'end') {
      setStatus('celebration');
      setExercise(null);
      return;
    }
    if (prefetchedExercise) {
      setExercise(prefetchedExercise);
      questionsSeenRef.current = prefetchedExercise.index + 1;
      setPrefetchedExercise(null);
      setStatus('question');
      setFeedback(null);
    } else {
      fetchNext();
    }
  }

  let body: ReactNode = null;

  if (status === 'loading') {
    const isFirstQuestion = questionsSeenRef.current === 0;
    body = (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-4">
        <p className="text-sm font-semibold text-slate-800">
          {isFirstQuestion ? 'We are picking your first challenge…' : 'We are finding your next challenge…'}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Just a moment while we craft a question that&apos;s just right for your brain.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-sky-700">
          <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-sky-500" />
          <span>Brain gears turning…</span>
        </div>
      </div>
    );
  } else if (status === 'empty') {
    body = (
      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-lg font-semibold text-amber-900">Nothing to practice just yet</p>
          <p className="mt-2 text-slate-700">
            We couldn&apos;t find a question for this topic right now. Try another subject or come back soon!
          </p>
        </div>
        <EndSessionButton sessionId={sessionId} learnerSlug={learnerSlug} />
      </div>
    );
  } else if (status === 'celebration') {
    body = (
      <div className="mt-4 space-y-4">
        <motion.div
          className="relative overflow-hidden rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-6 text-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, type: 'spring', stiffness: 120 }}
        >
          <p className="text-3xl font-extrabold text-emerald-900">🎉 Mission Complete!</p>
          <p className="mt-2 text-xl font-semibold text-emerald-800">+25 XP</p>
          <p className="mt-2 text-base text-slate-800">Your brain just got stronger!</p>

          <div className="pointer-events-none absolute inset-0">
            <motion.span
              className="absolute -left-4 top-3 text-2xl"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1, rotate: -10 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              ✨
            </motion.span>
            <motion.span
              className="absolute right-4 top-6 text-xl"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1, rotate: 10 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              🌟
            </motion.span>
            <motion.span
              className="absolute bottom-4 left-1/2 -translate-x-1/2 text-2xl"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              🎊
            </motion.span>
          </div>
        </motion.div>
        <EndSessionButton sessionId={sessionId} learnerSlug={learnerSlug} />
      </div>
    );
  } else if (status === 'feedback' && feedback) {
    body = (
      <div className="mt-4 rounded-xl border-2 border-slate-200 bg-slate-50 p-4">
        {feedback.correct && (
          <motion.div
            className="mb-4 overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-100 p-4"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, type: 'spring', stiffness: 140 }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-emerald-900">
                  Nice job {learnerName}! ✨
                </p>
                <p className="text-sm font-medium text-emerald-800">+10 XP</p>
              </div>
              <div className="relative h-10 w-10">
                <motion.span
                  className="absolute inset-0 rounded-full bg-emerald-400/30"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1.2, opacity: 0 }}
                  transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.6 }}
                />
                <motion.span
                  className="absolute inset-1 flex items-center justify-center rounded-full bg-emerald-500 text-lg"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  ✨
                </motion.span>
              </div>
            </div>
          </motion.div>
        )}

        <p className="text-lg font-semibold text-slate-900">
          {feedback.correct ? 'You got it right!' : 'Good try! Keep going.'}
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
  } else if (exercise && (exercise.exerciseId || exercise.prompt)) {
    body = (
      <>
        <p className="mt-4 text-sm text-slate-500">
          Question {exercise.index + 1}
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-700">🧠 Brain Warm-Up!</p>
        {exercise.exerciseId ? (
          <SessionQuestion
            sessionId={sessionId}
            exerciseId={exercise.exerciseId}
            skillId={exercise.skillId}
            prompt={exercise.prompt}
            answerType={exercise.answer_type}
            hints={exercise.hints}
            onResult={handleResult}
            onAnswerChange={setLatestAnswer}
            onAnswerSubmitted={setLatestAnswer}
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
  } else {
    body = (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-slate-600">No questions in this session. Head back and pick another topic!</p>
        <div className="mt-4">
          <EndSessionButton sessionId={sessionId} learnerSlug={learnerSlug} />
        </div>
      </div>
    );
  }

  const safeCompleted = Math.min(completedCount, missionTarget);
  const progressPercent = Math.max(0, Math.min(100, (safeCompleted / missionTarget) * 100));

  return (
    <div className="mt-6 lg:flex lg:items-start lg:gap-4">
      <div className="flex-1">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mission Progress
            </p>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {safeCompleted} / {missionTarget} questions complete
            </p>
          </div>
          <div className="shrink-0 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 shadow-sm">
            🔥 1 Day Streak
          </div>
        </div>

        {body}
      </div>
      <div className="lg:mt-0 lg:shrink-0">
        <AceChatPanel
          sessionId={sessionId}
          learnerName={learnerName}
          learnerSlug={learnerSlug}
          helperName={helperName}
          domain={domain}
          exerciseId={exercise?.exerciseId ?? null}
          skillId={exercise?.skillId ?? null}
          prompt={exercise?.prompt ?? null}
          learnerAnswer={latestAnswer}
        />
      </div>
    </div>
  );
}
