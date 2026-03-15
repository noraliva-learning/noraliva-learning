'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { speakNarration, stopNarration } from '@/lib/speech/narration';
import { AudioReplayButton } from './AudioReplayButton';
import { JoyfulButton } from '@/components/learner-ui/JoyfulButton';
import { WorkMat } from '@/components/workmat';
import type { WorkmatState } from '@/components/workmat';
import type { SceneWorkmatConfig } from '@/lib/workmat/workmat-schema';
import type { WorkmatValidationResult } from '@/lib/workmat/workmat-schema';
import { runValidation } from '@/lib/workmat/workmat-validation';

type Props = {
  displayText: string;
  voiceoverText?: string;
  expectedAnswer?: string | number | (string | number)[];
  validationRule?: string;
  hints?: string[];
  workmat?: SceneWorkmatConfig;
  onWorkmatStateChange?: (state: WorkmatState) => void;
  onWorkmatValidationResult?: (result: WorkmatValidationResult) => void;
  onResult: (correct: boolean, answer: string) => void;
  onHintUsed?: () => void;
  onGuidedSubmit?: (opts: { responseLatencyMs: number; answerChanged: boolean }) => void;
  autoPlayNarration?: boolean;
  onNarrationReplay?: () => void;
};

export function GuidedTryScene({
  displayText,
  voiceoverText,
  expectedAnswer,
  hints = [],
  workmat,
  onWorkmatStateChange,
  onWorkmatValidationResult,
  onResult,
  onHintUsed,
  onGuidedSubmit,
  autoPlayNarration = true,
  onNarrationReplay,
}: Props) {
  const [answer, setAnswer] = useState('');
  const [hintIndex, setHintIndex] = useState(-1);
  const workmatStateRef = useRef<WorkmatState | null>(null);
  const sceneMountedAtRef = useRef(Date.now());
  const firstNonEmptyAnswerRef = useRef<string | null>(null);
  const answerChangedRef = useRef(false);
  const textToSpeak = voiceoverText || displayText;

  const handleWorkmatStateChange = useCallback(
    (state: WorkmatState) => {
      workmatStateRef.current = state;
      onWorkmatStateChange?.(state);
    },
    [onWorkmatStateChange]
  );

  useEffect(() => {
    if (!textToSpeak?.trim() || !autoPlayNarration) return;
    const t = setTimeout(() => speakNarration(textToSpeak, { rate: 0.88 }), 400);
    return () => {
      clearTimeout(t);
      stopNarration();
    };
  }, [textToSpeak, autoPlayNarration]);

  function validate(a: string): boolean {
    if (expectedAnswer == null) return a.trim().length > 0;
    const normalized = a.trim().toLowerCase();
    if (Array.isArray(expectedAnswer)) {
      return expectedAnswer.some((v) => String(v).toLowerCase() === normalized);
    }
    return String(expectedAnswer).toLowerCase() === normalized;
  }

  function handleSubmit() {
    if (workmat?.workmat_enabled && workmat.validation_type && workmatStateRef.current) {
      const result = runValidation(workmat, workmatStateRef.current);
      onWorkmatValidationResult?.(result);
    }
    const trimmed = answer.trim();
    if (!trimmed && !workmat?.workmat_enabled) return;
    const responseLatencyMs = Date.now() - sceneMountedAtRef.current;
    onGuidedSubmit?.({ responseLatencyMs, answerChanged: answerChangedRef.current });
    stopNarration();
    onResult(trimmed ? validate(trimmed) : true, trimmed || '');
  }

  return (
    <motion.div
      className="rounded-2xl border-2 border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-6 shadow-sm"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 text-lg font-medium text-[rgb(var(--learner-text))]">{displayText}</p>
        <AudioReplayButton text={textToSpeak} aria-label="Replay question" onReplay={onNarrationReplay} />
      </div>
      <p className="mt-2 text-sm text-[rgb(var(--learner-text-muted))]">
        Your turn! Type your answer below.
      </p>
      {workmat?.workmat_enabled && (
        <div className="mt-4">
          <WorkMat
            config={{
              workmat_enabled: true,
              workmat_mode: workmat.workmat_mode ?? 'free_sketch',
              workmat_modality: workmat.workmat_modality,
              target_zones: workmat.target_zones ?? [],
              trace_paths: workmat.trace_paths ?? [],
              draggable_objects: workmat.draggable_objects ?? [],
              expected_marks: workmat.expected_marks ?? [],
              validation_type: workmat.validation_type,
              demo_overlays: workmat.demo_overlays ?? [],
            }}
            onStateChange={handleWorkmatStateChange}
            showDemoOverlay={(workmat.demo_overlays?.length ?? 0) > 0}
          />
        </div>
      )}
      <div className="mt-4 flex flex-col gap-3">
        <input
          type="text"
          inputMode="numeric"
          value={answer}
          onChange={(e) => {
            const v = e.target.value;
            if (v.trim()) {
              if (firstNonEmptyAnswerRef.current === null) firstNonEmptyAnswerRef.current = v.trim();
              else if (v.trim() !== firstNonEmptyAnswerRef.current) answerChangedRef.current = true;
            }
            setAnswer(v);
          }}
          placeholder="Type your answer"
          className="rounded-lg border border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-surface))] px-4 py-3 text-lg text-[rgb(var(--learner-text))] placeholder:text-[rgb(var(--learner-text-muted))]"
          aria-label="Your answer"
        />
        <JoyfulButton onClick={handleSubmit} variant="primary" disabled={!answer.trim()}>
          Check my answer
        </JoyfulButton>
      </div>
      {hints.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              setHintIndex((i) => (i < hints.length - 1 ? i + 1 : i));
              onHintUsed?.();
            }}
            className="text-sm text-[rgb(var(--learner-text-muted))] underline hover:text-[rgb(var(--learner-text))]"
          >
            {hintIndex < 0 ? 'Show hint' : hintIndex < hints.length - 1 ? 'Another hint' : 'Hints'}
          </button>
          {hintIndex >= 0 && (
            <motion.p
              className="mt-1 text-sm text-amber-800"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {hints[hintIndex]}
            </motion.p>
          )}
        </div>
      )}
    </motion.div>
  );
}
