'use client';

import { motion } from 'framer-motion';
import { BuddyAvatar } from './BuddyAvatar';
import type { BuddySlug } from '@/lib/supabase/types';

type Props = {
  open: boolean;
  buddySlug: BuddySlug | null;
  onResume: () => void;
};

/**
 * Pause screen after &quot;I need a break&quot; — no penalty, buddy stays kind.
 */
export function BreakOverlay({ open, buddySlug, onResume }: Props) {
  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[65] flex flex-col items-center justify-center bg-slate-900/55 px-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="break-overlay"
    >
      <div className="max-w-md rounded-3xl border-2 border-white/30 bg-white/95 p-8 text-center shadow-xl">
        <BuddyAvatar buddySlug={buddySlug} state="encourage" size="lg" className="mx-auto mb-4" />
        <p className="text-xl font-bold text-slate-900">Take your time.</p>
        <p className="mt-2 text-slate-700">Your buddy is here to help. Come back when you&apos;re ready.</p>
        <button
          type="button"
          onClick={onResume}
          className="mt-6 w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-white hover:bg-sky-600"
        >
          I&apos;m ready — back to learning
        </button>
      </div>
    </motion.div>
  );
}
