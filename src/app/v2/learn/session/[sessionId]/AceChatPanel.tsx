'use client';

import { useEffect, useMemo, useState } from 'react';
import { AceInput } from './AceInput';
import { AceMessage } from './AceMessage';

type AceChatPanelProps = {
  sessionId: string;
  learnerName: string;
  learnerSlug?: string;
  helperName: string;
  domain: string;
  exerciseId: string | null;
  skillId: string | null;
  prompt: string | null;
  learnerAnswer: string | null;
};

type ChatMessage = {
  id: string;
  from: 'ace' | 'learner';
  text: string;
};

export function AceChatPanel({
  sessionId,
  learnerName,
  learnerSlug,
  helperName,
  domain,
  exerciseId,
  skillId,
  prompt,
  learnerAnswer,
}: AceChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [lastAceText, setLastAceText] = useState<string | null>(null);
  const [hasAutoGreeted, setHasAutoGreeted] = useState(false);

  const hasExerciseContext = useMemo(() => !!exerciseId && !!prompt, [exerciseId, prompt]);

  useEffect(() => {
    if (hasAutoGreeted) return;
    const text = `Hi ${learnerName}! I'm Ace. Ask me if you want help with the question.`;
    const greeting: ChatMessage = {
      id: 'auto-greeting',
      from: 'ace',
      text,
    };
    setIsOpen(true);
    setMessages([greeting]);
    setHasAutoGreeted(true);

    if (typeof window !== 'undefined') {
      const timer = window.setTimeout(() => {
        setIsOpen(false);
      }, 4000);
      return () => window.clearTimeout(timer);
    }

    return;
  }, [learnerName, hasAutoGreeted]);

  function speak(text: string) {
    if (typeof window === 'undefined') return;
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    } catch {
      // If speech fails, we still show text.
    }
  }

  function handleReplay() {
    if (!lastAceText) return;
    speak(lastAceText);
  }

  async function handleSend(questionOverride?: string, fromVoice?: boolean) {
    const trimmed = questionOverride != null ? questionOverride.trim() : input.trim();
    if (!trimmed || loading) return;

    if (!hasExerciseContext) {
      setError(`${helperName} can help as soon as a question is ready on the screen.`);
      return;
    }

    setError(null);
    const learnerMsg: ChatMessage = {
      id: `learner-${Date.now()}`,
      from: 'learner',
      text: trimmed,
    };
    setMessages((prev) => [...prev, learnerMsg]);
    if (questionOverride == null) setInput('');
    setLoading(true);

    const previousMessages = messages;
    const history = previousMessages.slice(-10).map((m) => ({
      role: m.from === 'learner' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    }));

    try {
      const res = await fetch('/api/v2/ace/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          exerciseId,
          learnerAnswer: learnerAnswer ?? '',
          prompt: prompt ?? '',
          domain,
          skillId,
          question: trimmed,
          helperName,
          learnerName,
          history,
          learnerSlug: learnerSlug ?? undefined,
          inputSource: fromVoice ? 'voice' : 'text',
        }),
      });
      if (!res.ok) {
        const rawBody = await res.text();
        let errData: { error?: string } = {};
        try {
          errData = rawBody ? (JSON.parse(rawBody) as typeof errData) : {};
        } catch {
          /* ignore */
        }
        setError(`${helperName} had trouble answering. Try again.`);
        return;
      }
      const rawBody = await res.text();
      let data: {
        message?: string;
        explanation?: string;
        hints?: string[];
        example?: string;
        shouldSpeak?: boolean;
      } = {};
      try {
        data = rawBody ? (JSON.parse(rawBody) as typeof data) : {};
      } catch {
        setError(`${helperName} had trouble answering. Try again.`);
        return;
      }
      const message =
        typeof data.message === 'string' && data.message.length > 0
          ? data.message
          : typeof data.explanation === 'string' && data.explanation.length > 0
            ? data.explanation
            : '';
      if (!message) {
        setError(`${helperName} had trouble answering. Try again.`);
        return;
      }

      const parts: string[] = [message];
      if (Array.isArray(data.hints) && data.hints.length > 0) {
        parts.push(
          ['Here are some hints:', ...data.hints.map((h) => `• ${String(h)}`)].join('\n')
        );
      }
      if (typeof data.example === 'string' && data.example.trim()) {
        parts.push(`Another example:\n${data.example.trim()}`);
      }

      const aceText = parts.join('\n\n');
      const shouldSpeak = data.shouldSpeak !== false;

      const aceMsg: ChatMessage = {
        id: `helper-${Date.now()}`,
        from: 'ace',
        text: aceText,
      };
      setMessages((prev) => [...prev, aceMsg]);
      setLastAceText(aceText);
      if (shouldSpeak) speak(aceText);
    } catch (e) {
      setError(`${helperName} had trouble answering. Try again.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleMicClick() {
    if (typeof window === 'undefined') return;
    const anyWindow = window as unknown as {
      webkitSpeechRecognition?: any;
      SpeechRecognition?: any;
    };

    const SpeechRecognitionCtor =
      anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError('Voice input is not supported in this browser. You can still type your question.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setListening(true);
        setError(null);
      };
      recognition.onerror = () => {
        setListening(false);
        setError('I had trouble hearing that. Try again or type your question.');
      };
      recognition.onend = () => {
        setListening(false);
      };
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript ?? '';
        const trimmed = transcript.trim();
        if (!trimmed) {
          setError('I could not hear any words. Try again or type your question.');
          return;
        }
        setInput(trimmed);
        // Pass transcript so handleSend doesn't rely on stale input state.
        Promise.resolve().then(() => {
          (async () => {
            await handleSend(trimmed, true);
          })().catch(() => {});
        });
      };

      recognition.start();
    } catch {
      setListening(false);
      setError('Voice input had a problem starting. You can still type your question.');
    }
  }

  return (
    <div className="mt-4 w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:mt-0 lg:w-80">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
      >
        <span>💬 Ask {helperName}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {isOpen ? 'Hide' : 'Show'}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 flex flex-col gap-2">
          {!hasExerciseContext && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {helperName} will use the current question and your answer to help you. Once a
              question appears, you can ask for help here.
            </p>
          )}
          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
            {messages.map((m) => (
              <AceMessage key={m.id} from={m.from} text={m.text} helperName={helperName} />
            ))}
            {messages.length === 0 && (
              <p className="text-xs text-slate-500">
                Tap the button above and ask {helperName} for help with your question.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMicClick}
              className={`flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold shadow-sm ${
                listening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
              aria-label={`Ask ${helperName} with your voice`}
            >
              <span className="mr-1 text-sm">🎤</span>
              <span>Ask {helperName}</span>
            </button>
            <div className="flex-1">
              <AceInput
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              disabled={loading}
              helperName={helperName}
            />
            </div>
            <button
              type="button"
              onClick={handleReplay}
              disabled={!lastAceText}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              aria-label="Replay the last answer"
            >
              🔊
            </button>
          </div>
          {listening && (
            <p className="text-[11px] text-sky-700">
              Listening… speak clearly toward your device.
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

