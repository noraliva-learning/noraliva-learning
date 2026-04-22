import { describe, it, expect } from 'vitest';
import { isBuddySlug, buddyEmoji } from './buddyTypes';

describe('buddyTypes', () => {
  it('isBuddySlug validates known slugs', () => {
    expect(isBuddySlug('owl')).toBe(true);
    expect(isBuddySlug('monster')).toBe(true);
    expect(isBuddySlug('nope')).toBe(false);
    expect(isBuddySlug(null)).toBe(false);
  });

  it('buddyEmoji returns emoji for slug', () => {
    expect(buddyEmoji('dinosaur')).toBe('🦕');
    expect(buddyEmoji(null)).toBe('🦉');
  });
});
