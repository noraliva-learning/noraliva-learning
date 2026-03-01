"use client";

import { speak as speechSpeak, stopSpeaking } from "@/lib/speech";

/**
 * Child-friendly text-to-speech for mission questions and Ace helper responses.
 * Uses slightly slower rate and friendly voice for ages 5–7.
 */
export function speak(text: string): void {
  if (!text?.trim()) return;
  speechSpeak(text, {
    rate: 0.88,
    pitch: 1.05,
    volume: 1.0,
    voiceHint: /Samantha|Karen|Google US English|Microsoft Zira|child|friendly|en-US/i,
  });
}

export { stopSpeaking };

export default function AceVoice() {
  return null;
}
