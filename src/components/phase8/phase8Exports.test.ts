import { describe, it, expect } from 'vitest';
import { WorldBackground } from './WorldBackground';
import { BuddyAvatar } from './BuddyAvatar';
import { GamesComingSoon } from './GamesComingSoon';

describe('phase8 module exports', () => {
  it('exports components', () => {
    expect(typeof WorldBackground).toBe('function');
    expect(typeof BuddyAvatar).toBe('function');
    expect(typeof GamesComingSoon).toBe('function');
  });
});
