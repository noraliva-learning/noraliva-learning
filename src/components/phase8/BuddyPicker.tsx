'use client';

import { BUDDY_OPTIONS } from '@/lib/buddy/buddyTypes';
import type { BuddySlug } from '@/lib/supabase/types';

type Props = {
  selected: BuddySlug | null;
  onSelect: (slug: BuddySlug) => void;
  disabled?: boolean;
};

export function BuddyPicker({ selected, onSelect, disabled }: Props) {
  return (
    <div data-testid="buddy-picker">
      <p className="text-sm font-semibold text-[rgb(var(--learner-text))]">Pick your buddy</p>
      <p className="mt-1 text-xs text-[rgb(var(--learner-text-muted))]">Your buddy is here to help.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {BUDDY_OPTIONS.map((b) => {
          const active = selected === b.slug;
          return (
            <button
              key={b.slug}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(b.slug)}
              data-testid={`buddy-option-${b.slug}`}
              className={`flex min-w-[5.5rem] flex-col items-center rounded-2xl border-2 px-3 py-2 transition ${
                active
                  ? 'border-[rgb(var(--learner-progress))] bg-[rgb(var(--learner-panel))] shadow-md'
                  : 'border-[rgb(var(--learner-border))] bg-[rgb(var(--learner-card))] hover:border-[rgb(var(--learner-progress))]/60'
              }`}
            >
              <span className="text-3xl">{b.emoji}</span>
              <span className="mt-1 text-xs font-medium text-[rgb(var(--learner-text))]">{b.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
