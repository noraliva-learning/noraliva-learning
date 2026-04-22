'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { BuddyAvatar } from './BuddyAvatar';
import type { BuddySlug } from '@/lib/supabase/types';

type PropsSmall = {
  show: boolean;
  buddySlug: BuddySlug | null;
};

/** Quick burst after a correct answer — sparkles + buddy cheer */
export function SmallCorrectCelebration({ show, buddySlug }: PropsSmall) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-center pt-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="celebration-small"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-amber-200/30 via-fuchsia-200/20 to-transparent" />
          <motion.div
            initial={{ scale: 0.5, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative flex flex-col items-center gap-2"
          >
            <p className="rounded-full bg-white/90 px-4 py-2 text-lg font-bold text-emerald-700 shadow-lg">
              Nice job! ✨
            </p>
            <BuddyAvatar buddySlug={buddySlug} state="celebrate" size="md" />
            <div className="flex gap-2 text-2xl">
              {['🎉', '⭐', '🌈'].map((c) => (
                <motion.span
                  key={c}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                >
                  {c}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type PropsBig = {
  show: boolean;
  buddySlug: BuddySlug | null;
  learnerName: string;
  onDismiss: () => void;
};

/** Daily completion — dimmed backdrop, rainbow wash, confetti-like dots, buddy + message */
export function DailyCompleteCelebration({ show, buddySlug, learnerName, onDismiss }: PropsBig) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="celebration-daily-complete"
        >
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[...Array(24)].map((_, i) => (
              <motion.span
                key={i}
                className="absolute text-2xl"
                style={{ left: `${(i * 37) % 100}%`, top: '-10%' }}
                animate={{ y: ['0vh', '110vh'], rotate: [0, 360] }}
                transition={{
                  duration: 2.8 + (i % 5) * 0.2,
                  repeat: Infinity,
                  delay: i * 0.08,
                  ease: 'linear',
                }}
              >
                {['🎊', '✨', '🌈', '🎈', '⭐'][i % 5]}
              </motion.span>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-400/30 via-amber-300/25 to-cyan-400/30 mix-blend-screen" />
          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            className="relative z-10 max-w-md rounded-3xl border-4 border-white bg-gradient-to-br from-white via-amber-50 to-pink-50 p-8 text-center shadow-2xl"
          >
            <BuddyAvatar buddySlug={buddySlug} state="completion" size="lg" className="mx-auto mb-4 border-amber-200" />
            <p className="text-2xl font-extrabold text-slate-900">Hooray, {learnerName}!</p>
            <p className="mt-3 text-lg font-semibold text-emerald-800">
              Congratulations, you&apos;re done for today.
            </p>
            <p className="mt-2 text-base text-slate-700">I&apos;ll see you tomorrow.</p>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700"
            >
              OK!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
