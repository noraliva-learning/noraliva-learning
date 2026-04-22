'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { BuddyAvatar } from './BuddyAvatar';
import type { BuddySlug } from '@/lib/supabase/types';

type CannonSide = 'left' | 'right';

type CannonParticle = {
  id: string;
  icon: string;
  side: CannonSide;
  burstX: number;
  burstY: number;
  spin: number;
  delay: number;
  size: string;
};

const CONFETTI_ICONS = ['🎉', '🎊', '✨', '⭐', '🌈', '🎈'];
const CONFETTI_SIZES = ['text-lg', 'text-xl', 'text-2xl', 'text-3xl'];

function buildCannonParticles(totalPerSide: number): CannonParticle[] {
  const particles: CannonParticle[] = [];
  for (let i = 0; i < totalPerSide * 2; i += 1) {
    const side: CannonSide = i < totalPerSide ? 'left' : 'right';
    const idx = i % totalPerSide;
    const inwardBase = side === 'left' ? 320 : -320; // 45-ish inward launch
    const burstX = inwardBase + (Math.random() * 220 - 110);
    const burstY = -(420 + Math.random() * 320); // shoot upward
    const spin = side === 'left' ? 360 + Math.random() * 360 : -(360 + Math.random() * 360);
    particles.push({
      id: `${side}-${i}`,
      icon: CONFETTI_ICONS[i % CONFETTI_ICONS.length],
      side,
      burstX,
      burstY,
      spin,
      delay: idx * 0.025 + Math.random() * 0.06,
      size: CONFETTI_SIZES[i % CONFETTI_SIZES.length],
    });
  }
  return particles;
}

function CornerCannonConfetti({ burstKey }: { burstKey: string }) {
  const particles = buildCannonParticles(18);
  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden>
      {particles.map((p) => {
        const fromLeft = p.side === 'left';
        return (
          <motion.span
            key={`${burstKey}-${p.id}`}
            className={`absolute ${p.size} select-none`}
            style={{
              left: fromLeft ? 0 : '100%',
              bottom: 0,
              transform: 'translateX(-50%)',
            }}
            initial={{ x: fromLeft ? 0 : -10, y: 0, opacity: 0, scale: 0.8, rotate: 0 }}
            animate={{
              x: [fromLeft ? 0 : -10, p.burstX, p.burstX * 1.2],
              y: [0, p.burstY, p.burstY + 420], // gravity fall
              opacity: [0, 1, 1, 0],
              scale: [0.8, 1.1, 1],
              rotate: [0, p.spin],
            }}
            transition={{
              duration: 1.8,
              delay: p.delay,
              ease: [0.15, 0.8, 0.2, 1],
            }}
          >
            {p.icon}
          </motion.span>
        );
      })}
    </div>
  );
}

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
          className="pointer-events-none fixed inset-0 z-[120] flex items-start justify-center pt-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="celebration-small"
        >
          <CornerCannonConfetti burstKey="small" />
          <div className="absolute inset-0 bg-gradient-to-b from-amber-200/30 via-fuchsia-200/20 to-transparent" />
          <motion.div
            initial={{ scale: 0.5, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative z-20 flex flex-col items-center gap-2"
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

/** Daily completion — corner-cannon confetti above all UI + buddy + message */
export function DailyCompleteCelebration({ show, buddySlug, learnerName, onDismiss }: PropsBig) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[130] flex flex-col items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="celebration-daily-complete"
        >
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" />
          <CornerCannonConfetti burstKey="daily-complete" />
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-400/30 via-amber-300/25 to-cyan-400/30 mix-blend-screen" />
          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            className="relative z-20 max-w-md rounded-3xl border-4 border-white bg-gradient-to-br from-white via-amber-50 to-pink-50 p-8 text-center shadow-2xl"
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
