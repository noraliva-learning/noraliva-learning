'use client';

import { useEffect, useMemo, useState } from 'react';
import { AceInput } from './AceInput';
import { AceMessage } from './AceMessage';

type AceChatPanelProps = {
  sessionId: string;
  learnerName: string;
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

  const hasExerciseContext = useMemo(() => !!exerciseId && !!prompt, [exerciseId, prompt]);

  useEffect(() => {
    if (!isOpen || messages.length > 0) return;
    const welcome: ChatMessage = {
      id: 'welcome',
      from: 'ace',
      text: `Hi ${learnerName}! I’m ${helperName}. If you get stuck or want a hint about this question, you can ask me here.`,
    };
    setMessages([welcome]);
  }, [isOpen, learnerName, helperName, messages.length]);

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

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (!hasExerciseContext) {
      setError('Ace can help as soon as a question is ready on the screen.');
      return;
    }

    setError(null);
    const learnerMsg: ChatMessage = {
      id: `learner-${Date.now()}`,
      from: 'learner',
      text: trimmed,
    };
    setMessages((prev) => [...prev, learnerMsg]);
    setInput('');
    setLoading(true);

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
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText);
      }
      const data = (await res.json()) as {
        explanation?: string;
        hints?: string[];
        example?: string;
      };

      const parts: string[] = [];
      if (data.explanation) {
        parts.push(data.explanation);
      }
      if (data.hints && data.hints.length) {
        parts.push(
          ['Here are some hints:', ...data.hints.map((h) => `• ${h}`)].join('\n')
        );
      }
      if (data.example) {
        parts.push(`Another example:\n${data.example}`);
      }

      const aceText =
        parts.join('\n\n') ||
        'Let’s look at the question step by step. Try to explain what the question is asking in your own words first.';

      const aceMsg: ChatMessage = {
        id: `ace-${Date.now()}`,
        from: 'ace',
        text: aceText,
      };
      setMessages((prev) => [...prev, aceMsg]);
      setLastAceText(aceText);
      speak(aceText);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ace had trouble answering. Please try again.');
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
        // Send immediately so it feels like a voice question.
        // Use a microtask so state updates apply first.
        Promise.resolve().then(() => {
          (async () => {
            await handleSend();
          })().catch(() => {
            // errors are already handled in handleSend
          });
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
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg shadow-sm ${
                listening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
              aria-label="Ask with your voice"
            >
              🎤
            </button>
            <div className="flex-1">
              <AceInput value={input} onChange={setInput} onSend={handleSend} disabled={loading} />
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

