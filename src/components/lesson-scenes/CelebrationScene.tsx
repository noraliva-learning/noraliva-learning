'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { speakNarration, stopNarration } from '@/lib/speech/narration';
import { AudioReplayButton } from './AudioReplayButton';

type Props = {
  displayText: string;
  voiceoverText?: string;
  xp?: number;
  onContinue: () => void;
  autoPlayNarration?: boolean;
  onNarrationReplay?: () => void;
};

export function CelebrationScene({
  displayText,
  voiceoverText,
  xp = 25,
  onContinue,
  autoPlayNarration = true,
  onNarrationReplay,
}: Props) {
  const textToSpeak = voiceoverText || displayText;

  useEffect(() => {
    if (!textToSpeak?.trim() || !autoPlayNarration) return;
    const t = setTimeout(() => speakNarration(textToSpeak, { rate: 0.9, pitch: 1.1 }), 300);
    return () => {
      clearTimeout(t);
      stopNarration();
    };
  }, [textToSpeak, autoPlayNarration]);

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border-2 border-[rgb(var(--learner-success-strong))] bg-[rgb(var(--learner-celebration))] p-8 text-center"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, type: 'spring', stiffness: 120 }}
    >
      <div className="flex justify-center gap-2">
        <motion.p
          className="text-3xl font-extrabold text-[rgb(var(--learner-text))] sm:text-4xl"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {displayText}
        </motion.p>
        <AudioReplayButton text={textToSpeak} aria-label="Replay celebration" onReplay={onNarrationReplay} />
      </div>
      <motion.p
        className="mt-3 text-xl font-semibold text-[rgb(var(--learner-success-strong))]"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring' }}
      >
        +{xp} XP
      </motion.p>
      <motion.p
        className="mt-2 text-base text-[rgb(var(--learner-text))]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Your brain just got stronger!
      </motion.p>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-4">
        {['✨', '🌟', '🎊'].map((emoji, i) => (
          <motion.span
            key={emoji}
            className="text-2xl"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 * i + 0.2, duration: 0.35 }}
          >
            {emoji}
          </motion.span>
        ))}
      </div>
      <motion.div
        className="relative mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.button
          type="button"
          onClick={onContinue}
          className="rounded-xl bg-[rgb(var(--learner-cta))] px-6 py-3 font-semibold text-[rgb(var(--learner-cta-text))] shadow-md hover:opacity-95"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Done →
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
