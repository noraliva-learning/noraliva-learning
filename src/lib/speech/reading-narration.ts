/**
 * Phase 7: Reading narration — abstraction for letter sounds, words, sentences.
 * Uses browser speech synthesis for now; can be replaced with pre-recorded audio assets later.
 */

import { speakNarration, stopNarration } from './narration';

export type ReadingNarrationKind = 'letter_sound' | 'word' | 'sentence' | 'hint' | 'general';

/** Options for reading-specific narration (e.g. slower for decoding). */
export type ReadingNarrationOptions = {
  rate?: number;
  pitch?: number;
  /** If true, caller will replace with asset URL when available */
  useAssetWhenAvailable?: boolean;
};

/**
 * Speak a letter or letter sound. Example: readLetterSound('A', 'sound') → /ă/.
 * For now uses speech synthesis; later can play asset from /audio/letters/a.mp3.
 */
export function readLetterSound(
  letter: string,
  mode: 'name' | 'sound' = 'sound',
  options?: ReadingNarrationOptions
): void {
  if (options?.useAssetWhenAvailable) {
    // Placeholder: could resolve asset URL and play; fallback to synthesis
  }
  const text = mode === 'name' ? letter : letterToSoundHint(letter);
  speakNarration(text, { rate: options?.rate ?? 0.85, pitch: options?.pitch ?? 1.05 });
}

/**
 * Speak a word (e.g. for blending result or sight word).
 * Later can use word-level TTS or pre-recorded word list.
 */
export function readWord(word: string, options?: ReadingNarrationOptions): void {
  speakNarration(word, { rate: options?.rate ?? 0.88, pitch: options?.pitch ?? 1.05 });
}

/**
 * Read a short sentence aloud. Slower pace for early reading.
 */
export function readSentence(sentence: string, options?: ReadingNarrationOptions): void {
  speakNarration(sentence, { rate: options?.rate ?? 0.82, pitch: options?.pitch ?? 1.02 });
}

/** Hint or instruction for reading (e.g. "Say each sound"). */
export function readHint(text: string, options?: ReadingNarrationOptions): void {
  speakNarration(text, { rate: options?.rate ?? 0.88, pitch: options?.pitch ?? 1.05 });
}

export { stopNarration };

/** Simple letter-to-sound hint for synthesis (not full phonics; placeholder). */
function letterToSoundHint(letter: string): string {
  const upper = letter.toUpperCase();
  const hints: Record<string, string> = {
    A: 'ah',
    B: 'buh',
    C: 'kuh',
    D: 'duh',
    E: 'eh',
    F: 'fuh',
    G: 'guh',
    H: 'huh',
    I: 'ih',
    J: 'juh',
    K: 'kuh',
    L: 'luh',
    M: 'muh',
    N: 'nuh',
    O: 'oh',
    P: 'puh',
    Q: 'quuh',
    R: 'ruh',
    S: 'suh',
    T: 'tuh',
    U: 'uh',
    V: 'vuh',
    W: 'wuh',
    X: 'ks',
    Y: 'yuh',
    Z: 'zuh',
  };
  return hints[upper] ?? letter;
}
