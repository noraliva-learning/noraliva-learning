// src/lib/speech.ts
export function speak(
    text: string,
    opts?: { rate?: number; pitch?: number; volume?: number; voiceHint?: RegExp }
  ) {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
  
    // iOS can be finicky — cancel any ongoing speech first
    synth.cancel();
  
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts?.rate ?? 0.95;
    u.pitch = opts?.pitch ?? 1.05;
    u.volume = opts?.volume ?? 1.0;
  
    // Try to pick a good English voice if available
    const voices = synth.getVoices?.() ?? [];
    const voiceHint = opts?.voiceHint;
  
    const preferred =
      (voiceHint ? voices.find((v) => voiceHint.test(v.name)) : undefined) ||
      voices.find((v) => /en-US/i.test(v.lang) && /Siri|Enhanced|Premium/i.test(v.name)) ||
      voices.find((v) => /en/i.test(v.lang)) ||
      null;
  
    if (preferred) u.voice = preferred;
  
    synth.speak(u);
  }
  
  export function stopSpeaking() {
    if (typeof window === "undefined") return;
    window.speechSynthesis?.cancel?.();
  }