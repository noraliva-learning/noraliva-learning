import type { BuddySlug } from '@/lib/supabase/types';

export const BUDDY_OPTIONS: { slug: BuddySlug; label: string; emoji: string }[] = [
  { slug: 'owl', label: 'Owl', emoji: '🦉' },
  { slug: 'dinosaur', label: 'Dinosaur', emoji: '🦕' },
  { slug: 'cupcake', label: 'Cupcake', emoji: '🧁' },
  { slug: 'sloth', label: 'Sloth', emoji: '🦥' },
  { slug: 'monster', label: 'Blob', emoji: '👾' },
];

export function isBuddySlug(s: string | null | undefined): s is BuddySlug {
  return s === 'owl' || s === 'dinosaur' || s === 'cupcake' || s === 'sloth' || s === 'monster';
}

export function buddyEmoji(slug: BuddySlug | null | undefined): string {
  if (!slug || !isBuddySlug(slug)) return '🦉';
  return BUDDY_OPTIONS.find((b) => b.slug === slug)?.emoji ?? '🦉';
}

export type BuddyReactionState =
  | 'idle'
  | 'encourage'
  | 'celebrate'
  | 'retry'
  | 'completion';
