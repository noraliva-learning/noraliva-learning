'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { speakNarration, stopNarration } from '@/lib/speech/narration';
import { AudioReplayButton } from './AudioReplayButton';
import { JoyfulButton } from '@/components/learner-ui/JoyfulButton';

type Step = { text: string; voiceover?: string };

type Props = {
  displayText: string;
  voiceoverText?: string;
  steps?: Step[];
  onContinue: () => void;
  autoPlayNarration?: boolean;
  onNarrationReplay?: () => void;
};

export function WorkedExampleScene({
  displayText,
  voiceoverText,
  steps = [],
  onContinue,
  autoPlayNarration = true,
  onNarrationReplay,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const introText = voiceoverText || displayText;
  const currentStep = steps[stepIndex];
  const isLastStep = !currentStep || stepIndex >= steps.length - 1;

  useEffect(() => {
    if (!autoPlayNarration) return;
    if (stepIndex === 0 && introText) {
      const t = setTimeout(() => speakNarration(introText, { rate: 0.88 }), 400);
      return () => {
        clearTimeout(t);
        stopNarration();
      };
    }
    if (currentStep?.voiceover) {
      const t = setTimeout(() => speakNarration(currentStep.voiceover!, { rate: 0.88 }), 300);
      return () => {
        clearTimeout(t);
        stopNarration();
      };
    }
  }, [stepIndex, introText, currentStep?.voiceover, autoPlayNarration]);

  const handleNext = () => {
    stopNarration();
    if (isLastStep) onContinue();
    else setStepIndex((i) => i + 1);
  };

  return (
    <motion.div
      className="rounded-2xl border-2 border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-6 shadow-sm"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-[rgb(var(--learner-text))]">{displayText}</p>
          <AnimatePresence mode="wait">
            {currentStep ? (
              <motion.p
                key={stepIndex}
                className="mt-4 text-base text-[rgb(var(--learner-text))]"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.25 }}
              >
                {currentStep.text}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
        <AudioReplayButton
          text={currentStep?.voiceover || introText}
          aria-label="Replay step"
          onReplay={onNarrationReplay}
        />
      </div>
      <div className="mt-6 flex justify-end">
        <JoyfulButton onClick={handleNext} variant="primary">
          {isLastStep ? 'Next →' : 'Next step'}
        </JoyfulButton>
      </div>
    </motion.div>
  );
}
