'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { speakNarration, stopNarration } from '@/lib/speech/narration';
import { AudioReplayButton } from './AudioReplayButton';
import { JoyfulButton } from '@/components/learner-ui/JoyfulButton';

type Props = {
  displayText: string;
  hintText?: string;
  voiceoverText?: string;
  onContinue: () => void;
  autoPlayNarration?: boolean;
  onNarrationReplay?: () => void;
};

export function HintOverlay({
  displayText,
  hintText,
  voiceoverText,
  onContinue,
  autoPlayNarration = true,
  onNarrationReplay,
}: Props) {
  const textToSpeak = voiceoverText || hintText || displayText;

  useEffect(() => {
    if (!textToSpeak?.trim() || !autoPlayNarration) return;
    const t = setTimeout(() => speakNarration(textToSpeak, { rate: 0.9 }), 400);
    return () => {
      clearTimeout(t);
      stopNarration();
    };
  }, [textToSpeak, autoPlayNarration]);

  return (
    <motion.div
      className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-6 dark:border-amber-600 dark:bg-amber-950/30"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Hint
          </p>
          <p className="mt-1 text-base text-[rgb(var(--learner-text))]">
            {hintText || displayText}
          </p>
        </div>
        <AudioReplayButton text={textToSpeak} aria-label="Replay hint" onReplay={onNarrationReplay} />
      </div>
      <div className="mt-4 flex justify-end">
        <JoyfulButton onClick={onContinue} variant="secondary">
          Got it →
        </JoyfulButton>
      </div>
    </motion.div>
  );
}
