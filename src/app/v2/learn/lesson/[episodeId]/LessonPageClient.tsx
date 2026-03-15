'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setNarrationMuted, isNarrationMuted } from '@/lib/speech/narration';
import { MotionLessonRenderer, type LessonCompletionResult } from '@/components/lesson-scenes';
import type { LessonPlan } from '@/lib/instruction/lesson-plan-schema';

type Props = {
  episodeId: string;
  plan: LessonPlan;
  initialSceneIndex: number;
  learnerSlug: 'liv' | 'elle';
};

export function LessonPageClient({
  episodeId,
  plan,
  initialSceneIndex,
  learnerSlug,
}: Props) {
  const router = useRouter();
  const [muted, setMuted] = useState(false);
  const autoPlay = !muted;

  const handlePersist = useCallback(
    async (payload: { sceneIndex: number; completed: boolean }) => {
      try {
        await fetch(`/api/v2/instruction/episode/${episodeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_scene_index: payload.sceneIndex,
            completion_status: payload.completed ? 'completed' : 'in_progress',
          }),
        });
      } catch {
        // Non-blocking
      }
    },
    [episodeId]
  );

  const handleComplete = useCallback(
    async (result: LessonCompletionResult) => {
      try {
        await fetch(`/api/v2/instruction/episode/${episodeId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guided_try_success: result.guidedTrySuccess,
            independent_try_success: result.independentTrySuccess,
            hint_usage_count: result.hintUsageCount,
            completed_at: new Date().toISOString(),
            ...(result.workmatOutput && {
              workmat_output: {
                workmat_used: result.workmatOutput.workmat_used,
                state: result.workmatOutput.state,
                validation_result: result.workmatOutput.validation_result,
              },
            }),
            ...(result.learningSignals && { learning_signals: result.learningSignals }),
          }),
        });
      } catch {
        // Still redirect; completion is best-effort
      }
      handlePersist({ sceneIndex: plan.scene_sequence.length - 1, completed: true });
      router.push(`/v2/learners/${learnerSlug}`);
    },
    [episodeId, learnerSlug, plan.scene_sequence.length, handlePersist, router]
  );

  const toggleMute = () => {
    const next = !isNarrationMuted();
    setNarrationMuted(next);
    setMuted(next);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={toggleMute}
          className="rounded-lg border border-[rgb(var(--learner-border))] px-3 py-1.5 text-sm text-[rgb(var(--learner-text-muted))] hover:bg-[rgb(var(--learner-bg-subtle))]"
          aria-label={muted ? 'Unmute narration' : 'Mute narration'}
        >
          {muted ? '🔇 Unmute' : '🔊 Mute'}
        </button>
      </div>

      <MotionLessonRenderer
        plan={plan}
        episodeId={episodeId}
        learnerSlug={learnerSlug}
        autoPlayNarration={autoPlay}
        initialSceneIndex={initialSceneIndex}
        onLessonComplete={handleComplete}
        onPersistProgress={handlePersist}
      />
    </div>
  );
}
