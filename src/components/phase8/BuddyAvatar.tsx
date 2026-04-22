'use client';

import { motion } from 'framer-motion';
import type { BuddySlug } from '@/lib/supabase/types';
import { buddyEmoji, type BuddyReactionState } from '@/lib/buddy/buddyTypes';

type Props = {
  buddySlug: BuddySlug | null;
  state: BuddyReactionState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const motionFor: Record<BuddyReactionState, { scale: number[]; rotate?: number[] }> = {
  idle: { scale: [1, 1.02, 1] },
  encourage: { scale: [1, 1.08, 1], rotate: [-2, 2, 0] },
  celebrate: { scale: [1, 1.15, 1.05, 1], rotate: [-4, 4, -2, 0] },
  retry: { scale: [1, 0.96, 1], rotate: [0, -3, 0] },
  completion: { scale: [1, 1.12, 1], rotate: [-3, 3, 0] },
};

/**
 * Placeholder buddy: emoji + simple motion per lesson state (Rive can replace later).
 */
export function BuddyAvatar({ buddySlug, state, size = 'md', className = '' }: Props) {
  const emoji = buddyEmoji(buddySlug);
  const textSize = size === 'sm' ? 'text-3xl' : size === 'lg' ? 'text-7xl' : 'text-5xl';
  const cfg = motionFor[state];

  return (
    <motion.div
      className={`inline-flex select-none items-center justify-center rounded-2xl border-2 border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] px-3 py-2 shadow-sm ${className}`}
      data-testid="buddy-avatar"
      data-buddy-state={state}
      animate={{
        scale: cfg.scale,
        rotate: cfg.rotate ?? 0,
      }}
      transition={{
        duration: state === 'idle' ? 3 : 0.6,
        repeat: state === 'idle' ? Infinity : 0,
        ease: 'easeInOut',
      }}
      aria-hidden
    >
      <span className={textSize} role="img">
        {emoji}
      </span>
    </motion.div>
  );
}
