'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { speakNarration, stopNarration, narrationSupported } from '@/lib/speech/narration';

type Props = {
  text: string;
  className?: string;
  'aria-label'?: string;
  /** Phase 5: report narration replay for learning signals */
  onReplay?: () => void;
};

/**
 * Replay narration for the current scene. Does not block if audio fails.
 */
export function AudioReplayButton({ text, className = '', 'aria-label': ariaLabel, onReplay }: Props) {
  const handleReplay = useCallback(() => {
    if (!text?.trim()) return;
    stopNarration();
    speakNarration(text, { rate: 0.9, pitch: 1.05 });
    onReplay?.();
  }, [text, onReplay]);

  if (!narrationSupported()) return null;

  return (
    <motion.button
      type="button"
      onClick={handleReplay}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--learner-panel))] text-[rgb(var(--learner-text-muted))] hover:bg-[rgb(var(--learner-accent))] hover:text-[rgb(var(--learner-text))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--learner-cta))] ${className}`}
      aria-label={ariaLabel ?? 'Play again'}
      title="Play again"
      whileTap={{ scale: 0.95 }}
    >
      <span aria-hidden>🔊</span>
    </motion.button>
  );
}
