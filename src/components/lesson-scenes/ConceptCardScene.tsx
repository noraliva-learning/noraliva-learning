'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { speakNarration, stopNarration } from '@/lib/speech/narration';
import { AudioReplayButton } from './AudioReplayButton';
import { JoyfulButton } from '@/components/learner-ui/JoyfulButton';

type Props = {
  displayText: string;
  voiceoverText?: string;
  onContinue: () => void;
  autoPlayNarration?: boolean;
  onNarrationReplay?: () => void;
};

export function ConceptCardScene({
  displayText,
  voiceoverText,
  onContinue,
  autoPlayNarration = true,
  onNarrationReplay,
}: Props) {
  const textToSpeak = voiceoverText || displayText;

  useEffect(() => {
    if (!textToSpeak?.trim() || !autoPlayNarration) return;
    const t = setTimeout(() => {
      speakNarration(textToSpeak, { rate: 0.88, pitch: 1.05 });
    }, 500);
    return () => {
      clearTimeout(t);
      stopNarration();
    };
  }, [textToSpeak, autoPlayNarration]);

  return (
    <motion.div
      className="rounded-2xl border-2 border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-6 shadow-sm sm:p-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="flex items-start gap-3">
        <motion.div
          className="flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-lg font-medium text-[rgb(var(--learner-text))] sm:text-xl">
            {displayText}
          </p>
        </motion.div>
        <AudioReplayButton text={textToSpeak} aria-label="Replay concept" onReplay={onNarrationReplay} />
      </div>
      <motion.div
        className="mt-6 flex justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <JoyfulButton onClick={onContinue} variant="primary">
          Next →
        </JoyfulButton>
      </motion.div>
    </motion.div>
  );
}
