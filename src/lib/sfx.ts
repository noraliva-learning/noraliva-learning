// src/lib/sfx.ts
const cache: Record<string, HTMLAudioElement> = {};

export function playSfx(path: string, volume = 0.8) {
  if (typeof window === "undefined") return;

  const a = cache[path] ?? new Audio(path);
  cache[path] = a;

  a.volume = volume;
  a.currentTime = 0;

  a.play().catch(() => {
    // iOS may block until user interacts; safe to ignore.
  });
}