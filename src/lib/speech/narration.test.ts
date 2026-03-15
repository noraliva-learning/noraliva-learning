import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  speakNarration,
  stopNarration,
  setNarrationMuted,
  isNarrationMuted,
  narrationSupported,
} from './narration';

describe('narration', () => {
  beforeEach(() => {
    setNarrationMuted(false);
    vi.stubGlobal('window', {
      speechSynthesis: {
        cancel: vi.fn(),
        speak: vi.fn(),
        getVoices: () => [{ name: 'Test', lang: 'en-US' }],
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not throw when window is undefined', () => {
    const orig = globalThis.window;
    try {
      (globalThis as unknown as { window: unknown }).window = undefined;
      expect(() => speakNarration('Hello')).not.toThrow();
      expect(() => stopNarration()).not.toThrow();
    } finally {
      (globalThis as unknown as { window: unknown }).window = orig;
    }
  });

  it('does not speak when muted', () => {
    setNarrationMuted(true);
    const speak = vi.fn();
    vi.stubGlobal('window', {
      speechSynthesis: { cancel: vi.fn(), speak, getVoices: () => [] },
    });
    speakNarration('Hello');
    expect(speak).not.toHaveBeenCalled();
  });

  it('isNarrationMuted reflects setNarrationMuted', () => {
    setNarrationMuted(true);
    expect(isNarrationMuted()).toBe(true);
    setNarrationMuted(false);
    expect(isNarrationMuted()).toBe(false);
  });

  it('narrationSupported returns boolean', () => {
    expect(typeof narrationSupported()).toBe('boolean');
  });

  it('does not block on empty text', () => {
    expect(() => speakNarration('')).not.toThrow();
    expect(() => speakNarration('   ')).not.toThrow();
  });
});
