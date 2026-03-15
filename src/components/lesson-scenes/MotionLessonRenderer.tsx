'use client';

import { useCallback, useState } from 'react';
import type { LessonScene } from '@/lib/instruction/scene-schema';
import type { LessonPlan } from '@/lib/instruction/lesson-plan-schema';
import type { SceneWorkmatConfig } from '@/lib/workmat/workmat-schema';
import type { WorkmatState } from '@/components/workmat';
import type { WorkmatValidationResult } from '@/lib/workmat/workmat-schema';
import type { LearningSignals } from '@/lib/signals/learning-signals-schema';
import { stopNarration } from '@/lib/speech/narration';
import {
  FocusScene,
  VisualTeachingSequenceScene,
  ConceptCardScene,
  WorkedExampleScene,
  ManipulativeScene,
  GuidedTryScene,
  IndependentTryScene,
  HintOverlay,
  CelebrationScene,
} from './index';

export type WorkmatOutput = {
  workmat_used: boolean;
  state?: WorkmatState;
  validation_result?: WorkmatValidationResult;
};

export type LessonCompletionResult = {
  guidedTrySuccess: boolean;
  independentTrySuccess: boolean;
  hintUsageCount: number;
  promotionDecision?: string;
  workmatOutput?: WorkmatOutput;
  /** Phase 5: learning signals for insight layer */
  learningSignals?: LearningSignals;
};

type Props = {
  plan: LessonPlan;
  episodeId: string | null;
  learnerSlug: 'liv' | 'elle';
  autoPlayNarration?: boolean;
  initialSceneIndex?: number;
  onLessonComplete?: (result: LessonCompletionResult) => void;
  onPersistProgress?: (payload: { sceneIndex: number; completed: boolean }) => void;
};

export function MotionLessonRenderer({
  plan,
  episodeId,
  learnerSlug,
  autoPlayNarration = true,
  initialSceneIndex = 0,
  onLessonComplete,
  onPersistProgress,
}: Props) {
  const [sceneIndex, setSceneIndex] = useState(Math.max(0, initialSceneIndex));
  const [guidedCorrect, setGuidedCorrect] = useState<boolean | null>(null);
  const [independentCorrect, setIndependentCorrect] = useState<boolean | null>(null);
  const [hintUsageCount, setHintUsageCount] = useState(0);
  const [narrationReplayCount, setNarrationReplayCount] = useState(0);
  const [lastWorkmatState, setLastWorkmatState] = useState<WorkmatState | null>(null);
  const [lastWorkmatValidation, setLastWorkmatValidation] = useState<WorkmatValidationResult | null>(null);
  const [guidedSignals, setGuidedSignals] = useState<{ responseLatencyMs: number; answerChanged: boolean } | null>(null);
  const [independentSignals, setIndependentSignals] = useState<{ responseLatencyMs: number; answerChanged: boolean } | null>(null);
  const scenes = plan.scene_sequence;
  const scene = scenes[sceneIndex];

  const goNext = useCallback(() => {
    stopNarration();
    const next = sceneIndex + 1;
    if (next >= scenes.length) {
      const learningSignals: LearningSignals = {
        hint_requests_total: hintUsageCount,
        guided_success: guidedCorrect ?? false,
        independent_success: independentCorrect ?? false,
        narration_replay_count: narrationReplayCount,
        scene_replay_count: 0,
        scene_outcomes: [],
        workmat_used: lastWorkmatState != null,
        workmat_validation_type: lastWorkmatValidation?.validation_type,
        workmat_validation_valid: lastWorkmatValidation?.valid,
        response_latency_guided_ms: guidedSignals?.responseLatencyMs,
        response_latency_independent_ms: independentSignals?.responseLatencyMs,
        answer_changed_before_submit_guided: guidedSignals?.answerChanged,
        answer_changed_before_submit_independent: independentSignals?.answerChanged,
      };
      onLessonComplete?.({
        guidedTrySuccess: guidedCorrect ?? false,
        independentTrySuccess: independentCorrect ?? false,
        hintUsageCount,
        promotionDecision: plan.promotion_decision,
        workmatOutput:
          lastWorkmatState != null
            ? {
                workmat_used: true,
                state: lastWorkmatState,
                validation_result: lastWorkmatValidation ?? undefined,
              }
            : undefined,
        learningSignals,
      });
      onPersistProgress?.({ sceneIndex: next - 1, completed: true });
      return;
    }
    setSceneIndex(next);
    onPersistProgress?.({ sceneIndex: next, completed: false });
  }, [sceneIndex, scenes.length, guidedCorrect, independentCorrect, hintUsageCount, narrationReplayCount, guidedSignals, independentSignals, lastWorkmatState, lastWorkmatValidation, plan.promotion_decision, onLessonComplete, onPersistProgress]);

  const handleGuidedResult = useCallback((correct: boolean) => {
    setGuidedCorrect(correct);
    goNext();
  }, [goNext]);

  const handleIndependentResult = useCallback((correct: boolean) => {
    setIndependentCorrect(correct);
    goNext();
  }, [goNext]);

  const handleHintUsed = useCallback(() => {
    setHintUsageCount((c) => c + 1);
  }, []);

  if (!scene) {
    return (
      <div className="rounded-2xl border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-8 text-center">
        <p className="text-[rgb(var(--learner-text-muted))]">No more scenes. Lesson complete!</p>
      </div>
    );
  }

  switch (scene.type) {
    case 'focus_scene':
      return (
        <FocusScene
          displayText={scene.display_text ?? "Let's focus!"}
          voiceoverText={scene.voiceover_text}
          onContinue={goNext}
          autoPlayNarration={autoPlayNarration}
          onNarrationReplay={() => setNarrationReplayCount((c) => c + 1)}
        />
      );
    case 'visual_teaching_sequence': {
      const vts = scene.type === 'visual_teaching_sequence' ? scene : null;
      return (
        <VisualTeachingSequenceScene
          steps={vts?.steps ?? []}
          voiceoverText={scene.voiceover_text}
          displayText={scene.display_text}
          onContinue={goNext}
          autoPlayNarration={autoPlayNarration}
          onNarrationReplay={() => setNarrationReplayCount((c) => c + 1)}
        />
      );
    }
    case 'concept_card':
      return (
        <ConceptCardScene
          displayText={scene.display_text ?? 'Concept'}
          voiceoverText={scene.voiceover_text}
          onContinue={goNext}
          autoPlayNarration={autoPlayNarration}
          onNarrationReplay={() => setNarrationReplayCount((c) => c + 1)}
        />
      );
    case 'worked_example':
      return (
        <WorkedExampleScene
          displayText={scene.display_text ?? 'Example'}
          voiceoverText={scene.voiceover_text}
          steps={scene.type === 'worked_example' ? scene.steps : undefined}
          onContinue={goNext}
          autoPlayNarration={autoPlayNarration}
          onNarrationReplay={() => setNarrationReplayCount((c) => c + 1)}
        />
      );
    case 'manipulative': {
      const workmat = scene.workmat as SceneWorkmatConfig | undefined;
      return (
        <ManipulativeScene
          displayText={scene.display_text ?? 'Move the pieces'}
          voiceoverText={scene.voiceover_text}
          objects={scene.objects}
          workmat={workmat}
          onContinue={goNext}
          onWorkmatStateChange={setLastWorkmatState}
          onWorkmatValidationResult={setLastWorkmatValidation}
          autoPlayNarration={autoPlayNarration}
          onNarrationReplay={() => setNarrationReplayCount((c) => c + 1)}
        />
      );
    }
    case 'guided_try': {
      const guidedWorkmat = scene.workmat as SceneWorkmatConfig | undefined;
      return (
        <GuidedTryScene
          displayText={scene.display_text ?? 'Your turn'}
          voiceoverText={scene.voiceover_text}
          expectedAnswer={scene.expected_answer}
          validationRule={scene.validation_rule}
          hints={scene.hints}
          workmat={guidedWorkmat}
          onWorkmatStateChange={setLastWorkmatState}
          onWorkmatValidationResult={setLastWorkmatValidation}
          onResult={handleGuidedResult}
          onHintUsed={handleHintUsed}
          onGuidedSubmit={setGuidedSignals}
          autoPlayNarration={autoPlayNarration}
          onNarrationReplay={() => setNarrationReplayCount((c) => c + 1)}
        />
      );
    }
    case 'independent_try': {
      const independentWorkmat = scene.workmat as SceneWorkmatConfig | undefined;
      return (
        <IndependentTryScene
          displayText={scene.display_text ?? 'Try it yourself'}
          voiceoverText={scene.voiceover_text}
          expectedAnswer={scene.expected_answer}
          validationRule={scene.validation_rule}
          hints={scene.hints}
          workmat={independentWorkmat}
          onWorkmatStateChange={setLastWorkmatState}
          onWorkmatValidationResult={setLastWorkmatValidation}
          onResult={handleIndependentResult}
          onHintUsed={handleHintUsed}
          onIndependentSubmit={setIndependentSignals}
          autoPlayNarration={autoPlayNarration}
          onNarrationReplay={() => setNarrationReplayCount((c) => c + 1)}
        />
      );
    }
    case 'hint_step':
      return (
        <HintOverlay
          displayText={scene.display_text ?? 'Hint'}
          hintText={scene.type === 'hint_step' ? scene.hint_text : undefined}
          voiceoverText={scene.voiceover_text}
          onContinue={goNext}
          autoPlayNarration={autoPlayNarration}
          onNarrationReplay={() => setNarrationReplayCount((c) => c + 1)}
        />
      );
    case 'celebration':
      return (
        <CelebrationScene
          displayText={scene.display_text ?? "You did it!"}
          voiceoverText={scene.voiceover_text}
          xp={scene.type === 'celebration' ? scene.xp : undefined}
          onContinue={goNext}
          autoPlayNarration={autoPlayNarration}
          onNarrationReplay={() => setNarrationReplayCount((c) => c + 1)}
        />
      );
    default:
      return (
        <div className="rounded-2xl border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-6">
          <p className="text-[rgb(var(--learner-text))]">{(scene as LessonScene).display_text ?? 'Next'}</p>
          <button
            type="button"
            onClick={goNext}
            className="mt-4 rounded-lg bg-[rgb(var(--learner-cta))] px-4 py-2 text-[rgb(var(--learner-cta-text))]"
          >
            Next →
          </button>
        </div>
      );
  }
}
