/**
 * Phase 3: Narration layer for lesson scenes.
 * Provider-agnostic: browser speech synthesis for MVP; do not block lesson if audio fails.
 */

export type NarrationOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceHint?: RegExp;
};

let isMuted = false;

export function setNarrationMuted(muted: boolean): void {
  isMuted = muted;
}

export function isNarrationMuted(): boolean {
  return isMuted;
}

export function speakNarration(text: string, options?: NarrationOptions): void {
  if (typeof window === 'undefined') return;
  if (!text?.trim()) return;
  if (isMuted) return;

  const synth = window.speechSynthesis;
  if (!synth) return;

  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = options?.rate ?? 0.9;
    u.pitch = options?.pitch ?? 1.05;
    u.volume = options?.volume ?? 1.0;

    const voices = synth.getVoices?.() ?? [];
    const voiceHint = options?.voiceHint ?? /Samantha|Karen|Google US English|Microsoft Zira|child|friendly|en-US/i;
    const preferred =
      voices.find((v) => voiceHint.test(v.name)) ||
      voices.find((v) => /en-US/i.test(v.lang)) ||
      voices.find((v) => /en/i.test(v.lang)) ||
      null;
    if (preferred) u.voice = preferred;

    synth.speak(u);
  } catch {
    // Non-blocking: do not throw
  }
}

export function stopNarration(): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis?.cancel?.();
  } catch {
    // Non-blocking
  }
}

export function narrationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.speechSynthesis);
}
