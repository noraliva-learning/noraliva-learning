'use client';

import { motion } from 'framer-motion';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EndSessionButton } from './SessionActions';
import { SessionQuestion } from './SessionQuestion';
import { AceChatPanel } from './AceChatPanel';
import { JoyfulButton } from '@/components/learner-ui/JoyfulButton';
import { BuddyAvatar } from '@/components/phase8/BuddyAvatar';
import { SmallCorrectCelebration, DailyCompleteCelebration } from '@/components/phase8/CelebrationLayers';
import { BreakOverlay } from '@/components/phase8/BreakOverlay';
import type { BuddySlug } from '@/lib/supabase/types';
import type { BuddyReactionState } from '@/lib/buddy/buddyTypes';

type Props = {
  sessionId: string;
  learnerSlug: 'liv' | 'elle';
  learnerName: string;
  domain: string;
  buddySlug: BuddySlug | null;
  gradeLabel?: string | null;
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

export function SessionFlow({
  sessionId,
  learnerSlug,
  learnerName,
  domain,
  buddySlug,
  gradeLabel,
}: Props) {
  const [exercise, setExercise] = useState<Exercise>(null);
  const [prefetchedExercise, setPrefetchedExercise] = useState<Exercise>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [status, setStatus] = useState<'loading' | 'question' | 'feedback' | 'celebration' | 'empty'>('loading');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const questionsSeenRef = useRef(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [latestAnswer, setLatestAnswer] = useState<string | null>(null);
  const [showSmallCelebration, setShowSmallCelebration] = useState(false);
  const [showDailyComplete, setShowDailyComplete] = useState(false);
  const [breakOpen, setBreakOpen] = useState(false);
  const smallCelebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const helperName = learnerSlug === 'elle' ? 'Lila' : 'Dan';
  const missionTarget = 8;

  const buddyReaction: BuddyReactionState = useMemo(() => {
    if (breakOpen) return 'idle';
    if (status === 'feedback' && feedback) return feedback.correct ? 'celebrate' : 'retry';
    if (status === 'loading') return 'encourage';
    if (status === 'celebration') return 'completion';
    return 'idle';
  }, [breakOpen, status, feedback]);

  useEffect(() => {
    return () => {
      if (smallCelebrationTimer.current) clearTimeout(smallCelebrationTimer.current);
    };
  }, []);

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
      /* ignore */
    } finally {
      setIsPrefetching(false);
    }
  }, [isPrefetching, prefetchedExercise, sessionId]);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  async function handleBreak() {
    try {
      await fetch('/api/v2/learner/break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      /* still pause locally */
    }
    setBreakOpen(true);
  }

  function handleResult(f: Feedback) {
    setFeedback(f);
    setLatestAnswer(null);
    setCompletedCount((count) => {
      const next = count + 1;
      if (next === 1) {
        void (async () => {
          const res = await fetch('/api/v2/learner/daily-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markMinimum: true }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.dailyMinimumJustMet) setShowDailyComplete(true);
          }
        })();
      }
      return next;
    });
    if (f.correct) {
      setShowSmallCelebration(true);
      if (smallCelebrationTimer.current) clearTimeout(smallCelebrationTimer.current);
      smallCelebrationTimer.current = setTimeout(() => setShowSmallCelebration(false), 2200);
    }
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
      <div className="mt-4 rounded-2xl border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-4 shadow-sm">
        <p className="text-sm font-semibold text-[rgb(var(--learner-text))]">
          {isFirstQuestion ? 'We are picking your first challenge…' : 'We are finding your next challenge…'}
        </p>
        <p className="mt-1 text-sm text-[rgb(var(--learner-text-muted))]">
          Just a moment while we craft a question that&apos;s just right for your brain.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-[rgb(var(--learner-progress))]">
          <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-current" />
          <span>Brain gears turning…</span>
        </div>
      </div>
    );
  } else if (status === 'empty') {
    body = (
      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-panel))] p-6 text-center">
          <p className="text-lg font-semibold text-[rgb(var(--learner-text))]">Nothing to practice just yet</p>
          <p className="mt-2 text-[rgb(var(--learner-text-muted))]">
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
          className="relative overflow-hidden rounded-2xl border-2 border-[rgb(var(--learner-success-strong))] bg-[rgb(var(--learner-celebration))] p-6 text-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, type: 'spring', stiffness: 120 }}
        >
          <BuddyAvatar buddySlug={buddySlug} state="completion" size="md" className="mx-auto mb-3" />
          <p className="text-3xl font-extrabold text-[rgb(var(--learner-text))]">🎉 Mission Complete!</p>
          <p className="mt-2 text-xl font-semibold text-[rgb(var(--learner-success-strong))]">+25 XP</p>
          <p className="mt-2 text-base text-[rgb(var(--learner-text))]">Your brain just got stronger!</p>
          <p className="mt-2 text-sm text-[rgb(var(--learner-text-muted))]">See you next time!</p>
        </motion.div>
        <EndSessionButton sessionId={sessionId} learnerSlug={learnerSlug} />
      </div>
    );
  } else if (status === 'feedback' && feedback) {
    body = (
      <div className="mt-4 rounded-xl border-2 border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-panel))] p-4">
        {feedback.correct && (
          <motion.div
            className="mb-4 overflow-hidden rounded-xl border border-[rgb(var(--learner-success-strong))] bg-[rgb(var(--learner-success))] p-4"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, type: 'spring', stiffness: 140 }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-[rgb(var(--learner-text))]">Nice job! ✨</p>
                <p className="text-sm font-medium text-[rgb(var(--learner-success-strong))]">+10 XP</p>
              </div>
              <BuddyAvatar buddySlug={buddySlug} state="celebrate" size="sm" />
            </div>
          </motion.div>
        )}

        <p className="text-lg font-semibold text-[rgb(var(--learner-text))]">
          {feedback.correct
            ? feedback.encouragementMessage ||
              ['Nice job!', 'You got it!', `Great work, ${learnerName}!`, "Yes — that's right!"][completedCount % 4]
            : "Let's redo this. You've got this."}
        </p>
        {feedback.encouragementMessage && !feedback.correct && (
          <p className="mt-1 text-[rgb(var(--learner-text-muted))]">{feedback.encouragementMessage}</p>
        )}
        <p className="mt-1 text-sm text-[rgb(var(--learner-text-muted))]">You&apos;re at level {feedback.masteryLevel} on this skill.</p>
        {feedback.microLesson && (
          <div className="mt-3 rounded-lg border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-3 text-sm text-[rgb(var(--learner-text))]">
            <p className="font-medium">Quick tip</p>
            <p className="mt-1">{feedback.microLesson}</p>
          </div>
        )}
        <div className="mt-4">
          <JoyfulButton onClick={handleAdvance} variant="primary">
            Next question →
          </JoyfulButton>
        </div>
      </div>
    );
  } else if (exercise && (exercise.exerciseId || exercise.prompt)) {
    body = (
      <>
        <p className="mt-4 text-sm text-[rgb(var(--learner-text-muted))]">
          Question {exercise.index + 1}
          {gradeLabel ? (
            <span className="ml-2 rounded-full bg-[rgb(var(--learner-panel))] px-2 py-0.5 text-xs">
              {gradeLabel}
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-sm font-semibold text-[rgb(var(--learner-text))]">🧠 Brain warm-up</p>
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
            learnerSlug={learnerSlug}
          />
        ) : (
          <div className="mt-6 rounded-xl border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-panel))] p-4">
            <p className="text-[rgb(var(--learner-text))]">
              This one had a hiccup. Let&apos;s try the next question!
              {(exercise.debugReason || exercise.debugMessage) && (
                <span data-testid="generate-exercise-debug">
                  {' '}[{exercise.debugReason ?? ''}
                  {exercise.debugMessage ? `: ${exercise.debugMessage}` : ''}
                  {exercise.debugCode ? ` (${exercise.debugCode})` : ''}]
                </span>
              )}
            </p>
            <div className="mt-3">
              <JoyfulButton type="button" onClick={fetchNext} variant="primary">
                Next question →
              </JoyfulButton>
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <JoyfulButton type="button" variant="secondary" onClick={handleBreak} data-testid="break-button">
            Need a break?
          </JoyfulButton>
          <EndSessionButton sessionId={sessionId} learnerSlug={learnerSlug} />
        </div>
      </>
    );
  } else {
    body = (
      <div className="mt-4 rounded-xl border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-4">
        <p className="text-[rgb(var(--learner-text-muted))]">No questions in this session. Head back and pick another topic!</p>
        <div className="mt-4">
          <EndSessionButton sessionId={sessionId} learnerSlug={learnerSlug} />
        </div>
      </div>
    );
  }

  const safeCompleted = Math.min(completedCount, missionTarget);
  const progressPercent = Math.max(0, Math.min(100, (safeCompleted / missionTarget) * 100));

  const mainColumn = (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <BuddyAvatar buddySlug={buddySlug} state={buddyReaction} size="sm" />
            <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--learner-text-muted))]">
              Mission Progress
            </p>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[rgb(var(--learner-border))]">
            <div
              className="h-2 rounded-full bg-[rgb(var(--learner-progress))] transition-[width] duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-[rgb(var(--learner-text-muted))]">
            {safeCompleted} / {missionTarget} questions complete
          </p>
        </div>
        <div className="shrink-0 rounded-full bg-[rgb(var(--learner-accent))] px-3 py-1 text-xs font-semibold text-[rgb(var(--learner-text))] shadow-sm">
          🔥 1 Day Streak
        </div>
      </div>

      {body}
    </div>
  );

  return (
    <>
      <BreakOverlay
        open={breakOpen}
        buddySlug={buddySlug}
        onResume={() => setBreakOpen(false)}
      />
      <SmallCorrectCelebration show={showSmallCelebration} buddySlug={buddySlug} />
      <DailyCompleteCelebration
        show={showDailyComplete}
        buddySlug={buddySlug}
        learnerName={learnerName}
        onDismiss={() => setShowDailyComplete(false)}
      />
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6" data-testid="session-flow-main">
        {mainColumn}
        <div className="w-full shrink-0 lg:mt-0 lg:w-80" data-testid="ask-dan-panel">
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
    </>
  );
}
