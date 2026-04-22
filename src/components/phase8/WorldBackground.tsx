'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { LearnerSlug } from '@/lib/learner-theme';

type WorldKey = 'spring' | 'summer' | 'winter' | 'park';

function worldFromMonth(m: number): WorldKey {
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m === 11 || m <= 1) return 'winter';
  return 'park';
}

const WORLDS: Record<
  WorldKey,
  { gradient: string; deco: string; label: string; parallax: string }
> = {
  spring: {
    gradient: 'bg-gradient-to-br from-emerald-100 via-sky-50 to-amber-50',
    deco: '🌸',
    label: 'Spring garden',
    parallax: 'translate-y-4',
  },
  summer: {
    gradient: 'bg-gradient-to-br from-sky-200 via-cyan-50 to-lime-50',
    deco: '☀️',
    label: 'Sunny day',
    parallax: '-translate-y-2',
  },
  winter: {
    gradient: 'bg-gradient-to-br from-slate-200 via-blue-50 to-indigo-100',
    deco: '❄️',
    label: 'Snowy sky',
    parallax: 'translate-y-2',
  },
  park: {
    gradient: 'bg-gradient-to-br from-lime-100 via-amber-50 to-orange-50',
    deco: '🌳',
    label: 'Park play',
    parallax: 'translate-y-1',
  },
};

type Props = {
  children: React.ReactNode;
  learnerSlug: LearnerSlug | string;
};

/**
 * Lightweight world layer: gradient + decorative emoji; rotates by calendar month.
 */
export function WorldBackground({ children, learnerSlug }: Props) {
  const world = useMemo(() => {
    const m = new Date().getMonth();
    return WORLDS[worldFromMonth(m)];
  }, []);

  const floaters = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        icon: i % 5 === 0 ? '💖' : i % 3 === 0 ? '✨' : '●',
        left: 6 + ((i * 7.3) % 88),
        delay: (i % 7) * 0.6,
        duration: 10 + (i % 5) * 2,
        driftX: (i % 2 === 0 ? 1 : -1) * (8 + (i % 4) * 4),
        opacity: 0.1 + (i % 4) * 0.05,
        size: i % 3 === 0 ? 'text-xl' : i % 2 === 0 ? 'text-lg' : 'text-base',
      })),
    []
  );

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      data-world={world.label}
      data-learner={learnerSlug}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${world.gradient}`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute -left-8 top-24 text-7xl opacity-25 sm:text-8xl ${world.parallax}`}
        aria-hidden
      >
        {world.deco}
      </div>
      <div
        className="pointer-events-none absolute -right-10 bottom-32 text-6xl opacity-20 sm:text-7xl"
        aria-hidden
      >
        ✨
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
        {floaters.map((f) => (
          <motion.span
            key={f.id}
            className={`absolute ${f.size} ${f.icon === '●' ? 'text-white/50' : ''}`}
            style={{
              left: `${f.left}%`,
              bottom: '-8%',
              opacity: f.opacity,
              filter: 'blur(0.2px)',
            }}
            animate={{
              y: ['0vh', '-110vh'],
              x: [0, f.driftX, 0],
              opacity: [0, f.opacity, f.opacity * 1.2, f.opacity, 0],
              scale: [0.9, 1.05, 0.95, 1],
            }}
            transition={{
              duration: f.duration,
              delay: f.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {f.icon}
          </motion.span>
        ))}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
