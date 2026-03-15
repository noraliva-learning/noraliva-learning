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

export function FocusScene({
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
    }, 400);
    return () => {
      clearTimeout(t);
      stopNarration();
    };
  }, [textToSpeak, autoPlayNarration]);

  return (
    <motion.div
      className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] p-8 text-center"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="flex w-full max-w-lg items-start justify-center gap-2">
        <motion.p
          className="text-2xl font-bold text-[rgb(var(--learner-text))] sm:text-3xl"
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.35 }}
        >
          {displayText}
        </motion.p>
        <AudioReplayButton text={textToSpeak} aria-label="Replay focus" onReplay={onNarrationReplay} />
      </div>
      <motion.div
        className="mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <JoyfulButton onClick={onContinue} variant="primary">
          I&apos;m ready →
        </JoyfulButton>
      </motion.div>
    </motion.div>
  );
}
