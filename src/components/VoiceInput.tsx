"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionResultEvent {
  results: { length: number; [index: number]: { length: number; [index: number]: { transcript?: string } } };
}

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const SpeechRecognitionAPI: SpeechRecognitionCtor | null =
  typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition) ?? null
    : null;

export interface VoiceInputProps {
  onResult: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Optional: current value to show (e.g. feedback text). */
  value?: string;
  /** Optional: called when recognition starts/stops (e.g. for mic animation). */
  onListeningChange?: (listening: boolean) => void;
  className?: string;
  /** Large touch target for kids (default true). */
  largeTouchTarget?: boolean;
}

export default function VoiceInput({
  onResult,
  disabled = false,
  onListeningChange,
  className = "",
  largeTouchTarget = true,
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<InstanceType<NonNullable<typeof SpeechRecognitionAPI>> | null>(
    null
  );

  useEffect(() => {
    setIsSupported(!!SpeechRecognitionAPI);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI || disabled) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      onListeningChange?.(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      onListeningChange?.(false);
    };

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0]?.transcript?.trim() ?? "";
      if (transcript) onResult(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      onListeningChange?.(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [disabled, onResult, onListeningChange]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // already ended
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    onListeningChange?.(false);
  }, [onListeningChange]);

  const handleMicClick = () => {
    if (isListening) stopListening();
    else startListening();
  };

  if (!isSupported) return null;

  const touchClass = largeTouchTarget
    ? "min-h-[48px] min-w-[48px] p-3 rounded-2xl"
    : "min-h-[40px] min-w-[40px] p-2 rounded-xl";

  return (
    <button
      type="button"
      onClick={handleMicClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center
        border-2 border-neutral-200 bg-white
        text-neutral-700
        transition-all
        hover:bg-neutral-50 hover:border-neutral-300
        focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
        disabled:opacity-50 disabled:pointer-events-none
        ${touchClass}
        ${isListening ? "bg-amber-50 border-amber-400 animate-pulse" : ""}
        ${className}
      `}
      aria-label={isListening ? "Stop listening" : "Speak your answer"}
      title={isListening ? "Tap to stop" : "Tap to speak"}
    >
      <span className="text-2xl" role="img" aria-hidden>
        {isListening ? "🎤" : "🎙️"}
      </span>
    </button>
  );
}
