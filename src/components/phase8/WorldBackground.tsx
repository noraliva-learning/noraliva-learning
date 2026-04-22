'use client';

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
      <div className="relative z-10">{children}</div>
    </div>
  );
}
