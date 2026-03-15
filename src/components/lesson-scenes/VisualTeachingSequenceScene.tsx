'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { speakNarration, stopNarration } from '@/lib/speech/narration';
import { AudioReplayButton } from './AudioReplayButton';
import { JoyfulButton } from '@/components/learner-ui/JoyfulButton';
import type { VisualTeachingStep, VisualTeachingStepAnimation } from '@/lib/instruction/scene-schema';

const DEFAULT_STEP_MS = 1600;
const STEP_TRANSITION_MS = 400;

type Props = {
  steps: VisualTeachingStep[];
  voiceoverText?: string;
  displayText?: string;
  onContinue: () => void;
  autoPlayNarration?: boolean;
  onNarrationReplay?: () => void;
};

/** Phase 6: Minimal visual representation for each animation type (math-first) */
function StepVisual({ animation }: { animation: VisualTeachingStepAnimation }) {
  switch (animation) {
    case 'groups_appear':
      return (
        <motion.div
          className="flex flex-wrap justify-center gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.2 } },
            hidden: {},
          }}
        >
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--learner-accent))] text-lg font-bold text-[rgb(var(--learner-card))]"
              variants={{ hidden: { opacity: 0, scale: 0 }, visible: { opacity: 1, scale: 1 } }}
              transition={{ duration: 0.4 }}
            >
              •
            </motion.div>
          ))}
        </motion.div>
      );
    case 'dots_fill_groups':
      return (
        <motion.div
          className="flex justify-center gap-8"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.15 } }, hidden: {} }}
        >
          {[1, 2, 3].map((g) => (
            <motion.div
              key={g}
              className="flex gap-1"
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            >
              {[1, 2, 3].map((d) => (
                <motion.span
                  key={d}
                  className="h-3 w-3 rounded-full bg-[rgb(var(--learner-cta))]"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * d, duration: 0.25 }}
                />
              ))}
            </motion.div>
          ))}
        </motion.div>
      );
    case 'highlight_rows':
      return (
        <motion.div
          className="grid grid-cols-3 gap-2"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.12 } }, hidden: {} }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <motion.div
              key={i}
              className="h-8 w-8 rounded bg-[rgb(var(--learner-accent))]"
              variants={{ hidden: { opacity: 0.4 }, visible: { opacity: 1 } }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </motion.div>
      );
    case 'rotate_to_array':
      return (
        <motion.div
          className="grid grid-cols-3 gap-2"
          initial={{ opacity: 0, rotate: -8 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ duration: 0.5 }}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <motion.div
              key={i}
              className="h-8 w-8 rounded bg-[rgb(var(--learner-cta))]"
              layout
            />
          ))}
        </motion.div>
      );
    case 'object_appear':
      return (
        <motion.div
          className="flex justify-center gap-2"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } }, hidden: {} }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.div
              key={i}
              className="h-10 w-10 rounded-lg bg-[rgb(var(--learner-accent))]"
              variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </motion.div>
      );
    case 'grouping':
      return (
        <motion.div
          className="flex justify-center gap-4"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.2 } }, hidden: {} }}
        >
          {[1, 2].map((g) => (
            <motion.div
              key={g}
              className="flex gap-1 rounded-xl border-2 border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-panel))] p-2"
              variants={{ hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1 } }}
              transition={{ duration: 0.35 }}
            >
              {[1, 2, 3].map((d) => (
                <span key={d} className="h-4 w-4 rounded-full bg-[rgb(var(--learner-cta))]" />
              ))}
            </motion.div>
          ))}
        </motion.div>
      );
    case 'highlighting':
      return (
        <motion.div
          className="flex justify-center"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.15 } }, hidden: {} }}
        >
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="mx-1 h-12 w-12 rounded-xl bg-[rgb(var(--learner-cta))]"
              variants={{ hidden: { opacity: 0.5, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </motion.div>
      );
    case 'counting':
      return (
        <motion.div
          className="flex justify-center gap-2"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.15 } }, hidden: {} }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.span
              key={i}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--learner-accent))] text-lg font-bold text-[rgb(var(--learner-card))]"
              variants={{ hidden: { opacity: 0, scale: 0 }, visible: { opacity: 1, scale: 1 } }}
              transition={{ duration: 0.25 }}
            >
              {i}
            </motion.span>
          ))}
        </motion.div>
      );
    case 'combine_groups':
      return (
        <motion.div
          className="flex flex-col items-center gap-3"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.2 } }, hidden: {} }}
        >
          <motion.div
            className="flex gap-2"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          >
            <span className="rounded bg-[rgb(var(--learner-panel))] px-3 py-1 text-sm">2</span>
            <span className="text-[rgb(var(--learner-text-muted))]">+</span>
            <span className="rounded bg-[rgb(var(--learner-panel))] px-3 py-1 text-sm">3</span>
          </motion.div>
          <motion.div
            className="flex gap-1"
            variants={{ hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1 } }}
            transition={{ duration: 0.4 }}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="h-8 w-8 rounded-full bg-[rgb(var(--learner-cta))]" />
            ))}
          </motion.div>
        </motion.div>
      );
    case 'take_away':
      return (
        <motion.div
          className="flex flex-col items-center gap-3"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.15 } }, hidden: {} }}
        >
          <motion.div
            className="flex gap-1"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.span
                key={i}
                className="h-8 w-8 rounded-full bg-[rgb(var(--learner-cta))]"
                exit={i <= 2 ? { opacity: 0, x: -20 } : {}}
                transition={{ duration: 0.25 }}
              />
            ))}
          </motion.div>
          <motion.p
            className="text-sm text-[rgb(var(--learner-text-muted))]"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          >
            Take 2 away → 3 left
          </motion.p>
        </motion.div>
      );
    case 'structure_reveal':
      return (
        <motion.div
          className="grid grid-cols-2 gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="h-10 w-10 rounded bg-[rgb(var(--learner-accent))]"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.05 * i, duration: 0.25 }}
            />
          ))}
        </motion.div>
      );
    case 'number_line_jump':
      return (
        <motion.div
          className="relative flex items-center gap-1"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } }, hidden: {} }}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.div
              key={i}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[rgb(var(--learner-border))] text-sm font-medium text-[rgb(var(--learner-text))]"
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            >
              {i}
            </motion.div>
          ))}
          <motion.div
            className="absolute left-2 h-6 w-6 rounded-full bg-[rgb(var(--learner-cta))]"
            animate={{ x: [0, 44, 88] }}
            transition={{ duration: 1.2, repeat: 0 }}
          />
        </motion.div>
      );
    case 'rotation':
      return (
        <motion.div
          className="flex justify-center"
          animate={{ rotate: 90 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          <div className="grid grid-cols-2 gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-10 rounded bg-[rgb(var(--learner-accent))]" />
            ))}
          </div>
        </motion.div>
      );
    case 'transformation':
      return (
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="h-20 w-20 rounded-xl bg-[rgb(var(--learner-cta))]" />
        </motion.div>
      );
    case 'sound_to_letter_reveal':
      return (
        <motion.div
          className="flex flex-col items-center gap-4"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.2 } }, hidden: {} }}
        >
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-xl bg-[rgb(var(--learner-accent))] text-2xl font-bold text-[rgb(var(--learner-card))]"
            variants={{ hidden: { opacity: 0, scale: 0 }, visible: { opacity: 1, scale: 1 } }}
          >
            A
          </motion.div>
          <motion.span
            className="text-sm text-[rgb(var(--learner-text-muted))]"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          >
            /ă/
          </motion.span>
        </motion.div>
      );
    case 'blend_sound_sequence':
      return (
        <motion.div
          className="flex items-center justify-center gap-2"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.25 } }, hidden: {} }}
        >
          {['c', 'a', 't'].map((letter, i) => (
            <motion.span
              key={i}
              className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-[rgb(var(--learner-border))] text-xl font-bold text-[rgb(var(--learner-text))]"
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            >
              {letter}
            </motion.span>
          ))}
        </motion.div>
      );
    case 'stretch_and_merge_word':
      return (
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.span
            className="text-2xl font-bold text-[rgb(var(--learner-text))]"
            animate={{ letterSpacing: ['0.2em', '0.05em'] }}
            transition={{ duration: 1 }}
          >
            cat
          </motion.span>
        </motion.div>
      );
    case 'highlight_beginning_sound':
      return (
        <motion.div
          className="flex items-center justify-center gap-1"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.15 } }, hidden: {} }}
        >
          <motion.span
            className="rounded bg-[rgb(var(--learner-cta))] px-2 py-1 text-xl font-bold text-[rgb(var(--learner-card))]"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          >
            c
          </motion.span>
          <span className="text-xl font-bold text-[rgb(var(--learner-text))]">at</span>
        </motion.div>
      );
    case 'segment_into_phonemes':
      return (
        <motion.div
          className="flex items-center justify-center gap-2"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.15 } }, hidden: {} }}
        >
          {['c', 'a', 't'].map((letter, i) => (
            <motion.span
              key={i}
              className="flex h-10 w-10 items-center justify-center rounded bg-[rgb(var(--learner-panel))] text-lg font-bold text-[rgb(var(--learner-text))]"
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            >
              {letter}
            </motion.span>
          ))}
        </motion.div>
      );
    default:
      return (
        <motion.div
          className="flex justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          <div className="h-12 w-12 rounded-full bg-[rgb(var(--learner-accent))]" />
        </motion.div>
      );
  }
}

export function VisualTeachingSequenceScene({
  steps: stepsProp,
  voiceoverText,
  displayText,
  onContinue,
  autoPlayNarration = true,
  onNarrationReplay,
}: Props) {
  const steps = stepsProp?.length ? stepsProp : [{ animation: 'object_appear' as const }];
  const [stepIndex, setStepIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex >= steps.length - 1;
  const sceneVoiceover = voiceoverText || displayText || '';

  useEffect(() => {
    if (!autoPlayNarration) return;
    if (stepIndex === 0 && sceneVoiceover?.trim()) {
      const t = setTimeout(() => speakNarration(sceneVoiceover, { rate: 0.88, pitch: 1.05 }), 500);
      return () => {
        clearTimeout(t);
        stopNarration();
      };
    }
    if (currentStep?.voiceover_text?.trim()) {
      const t = setTimeout(() => speakNarration(currentStep.voiceover_text!, { rate: 0.88 }), 300);
      return () => {
        clearTimeout(t);
        stopNarration();
      };
    }
  }, [stepIndex, sceneVoiceover, currentStep?.voiceover_text, autoPlayNarration]);

  const durationMs = currentStep?.duration_ms ?? DEFAULT_STEP_MS;
  useEffect(() => {
    if (!currentStep) return;
    const t = setTimeout(() => {
      if (isLastStep) return;
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, durationMs);
    return () => clearTimeout(t);
  }, [stepIndex, currentStep, durationMs, isLastStep, steps.length]);

  const handleNext = () => {
    stopNarration();
    if (isLastStep) onContinue();
    else setStepIndex((i) => i + 1);
  };

  const handleReplay = () => {
    stopNarration();
    setStepIndex(0);
    setReplayKey((k) => k + 1);
    if (sceneVoiceover?.trim()) {
      setTimeout(() => speakNarration(sceneVoiceover, { rate: 0.88 }), 300);
    }
    onNarrationReplay?.();
  };

  const replayButtonText = currentStep?.voiceover_text || sceneVoiceover;

  return (
    <motion.div
      key={replayKey}
      className="rounded-2xl border-2 border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-6 shadow-sm sm:p-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-start justify-between gap-3">
        {displayText ? (
          <p className="text-sm font-medium text-[rgb(var(--learner-text-muted))]">{displayText}</p>
        ) : (
          <span className="text-sm text-[rgb(var(--learner-text-muted))]">
            Step {stepIndex + 1} of {steps.length}
          </span>
        )}
        <AudioReplayButton
          text={replayButtonText}
          aria-label="Replay"
          onReplay={onNarrationReplay}
        />
      </div>

      <div className="mt-6 min-h-[140px]">
        <AnimatePresence mode="wait">
          {currentStep && (
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: STEP_TRANSITION_MS / 1000 }}
              className="flex flex-col items-center justify-center"
            >
              <StepVisual animation={currentStep.animation} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleReplay}
          className="rounded-lg border border-[rgb(var(--learner-border))] px-3 py-1.5 text-sm text-[rgb(var(--learner-text-muted))] hover:bg-[rgb(var(--learner-panel))]"
        >
          Replay
        </button>
        <JoyfulButton onClick={handleNext} variant="primary">
          {isLastStep ? 'Next →' : 'Next step'}
        </JoyfulButton>
      </div>
    </motion.div>
  );
}
