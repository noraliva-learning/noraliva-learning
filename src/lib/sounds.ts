/**
 * Kid-friendly sound effects for the learning experience.
 * Correct → applause/sparkle; Wrong → soft encouraging tone.
 */

const cache: Record<string, HTMLAudioElement> = {};

const SOUNDS = {
  correct: "/sounds/correct.mp3",
  wrong: "/sounds/wrong.mp3",
  celebrate: "/sounds/applause.mp3",
} as const;

function getAudio(path: string): HTMLAudioElement {
  if (cache[path]) return cache[path];
  const a = new Audio(path);
  cache[path] = a;
  return a;
}

function play(path: string, volume = 0.85): void {
  if (typeof window === "undefined") return;
  const a = getAudio(path);
  a.volume = Math.min(1, Math.max(0, volume));
  a.currentTime = 0;
  a.play().catch(() => {
    // Autoplay may be blocked until user interaction (e.g. iPad).
  });
}

/** Play when the learner gets an answer correct (applause / positive). */
export function playCorrect(): void {
  play(SOUNDS.correct, 0.9);
}

/** Play when the answer is wrong — soft, encouraging tone (no harsh buzz). */
export function playWrong(): void {
  play(SOUNDS.wrong, 0.7);
}

/** Play for celebration (e.g. mission complete). */
export function playCelebrate(): void {
  play(SOUNDS.celebrate, 0.85);
}
