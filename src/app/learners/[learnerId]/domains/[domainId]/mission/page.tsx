"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Feeling =
  | "confused"
  | "frustrated"
  | "dont_know"
  | "too_easy"
  | "too_hard";

function getLocalNumber(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function setLocalNumber(key: string, value: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(value));
}

export default function MissionPage({
  params,
}: {
  params: { learnerId: string; domainId: string };
}) {
  const { learnerId, domainId } = params;

  // MVP: local “progress”
  const [xp, setXp] = useState(() => getLocalNumber(`xp:${learnerId}`, 0));
  const [streak, setStreak] = useState(() =>
    getLocalNumber(`streak:${learnerId}`, 0)
  );

  const [step, setStep] = useState<"play" | "done">("play");
  const [aceOpen, setAceOpen] = useState(false);
  const [aceMode, setAceMode] = useState<"ask" | "feeling">("ask");
  const [aceText, setAceText] = useState(
    "Hi! I’m Ace. Want a hint, or want me to walk you through one tiny step?"
  );

  // MVP: one simple question (we’ll swap to generated later)
  const question = useMemo(() => {
    // You can seed different questions by domainId later.
    return {
      prompt: "What is 7 + 5 ?",
      choices: ["10", "11", "12", "13"],
      answer: "12",
      skill: "Add within 20",
      hint: "Try: 7 + 5 = 7 + 3 + 2. 7 + 3 = 10, then +2 = 12.",
    };
  }, []);

  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function openAceForHint() {
    setAceMode("ask");
    setAceText(question.hint);
    setAceOpen(true);
  }

  function openAceForAsk() {
    setAceMode("ask");
    // MVP: gentle, short, specific
    setAceText(
      `Let’s do one tiny step.\n\nWe’re adding: 7 + 5.\nBreak 5 into 3 + 2.\n7 + 3 = 10.\n10 + 2 = 12.\n\nWant to try again, or want one more example?`
    );
    setAceOpen(true);
  }

  function openAceForFeeling(f: Feeling) {
    setAceMode("feeling");
    const scripts: Record<Feeling, string> = {
      confused:
        "That makes sense. Confused means your brain is learning.\n\nLet’s do ONE tiny step together. Want a hint or want me to show a mini-example?",
      frustrated:
        "You’re safe. We can do hard things.\n\nPick one:\n1) Try a smaller one\n2) Take a quick win",
      dont_know:
        "Totally okay. Not knowing is the start.\n\nWant a hint first, or want me to walk you through it?",
      too_easy:
        "Nice. That means you’re ready for a harder one.\n\nAfter this, I’ll give you a “boss” version.",
      too_hard:
        "Got it. Let’s make it smaller.\n\nWe’ll do fewer questions and end with a celebration win.",
    };

    setAceText(scripts[f]);
    setAceOpen(true);
  }

  function submitAnswer() {
    if (!selected) return;
    if (selected === question.answer) {
      setFeedback("✅ Correct!");
      // reward
      const nextXp = xp + 10;
      const nextStreak = streak + 1;
      setXp(nextXp);
      setStreak(nextStreak);
      setLocalNumber(`xp:${learnerId}`, nextXp);
      setLocalNumber(`streak:${learnerId}`, nextStreak);

      setTimeout(() => setStep("done"), 600);
    } else {
      setFeedback("Try again 💛");
      // “predict struggle” placeholder
      setTimeout(() => openAceForHint(), 250);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-10">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/learners/${learnerId}/domains`}
          className="text-sm underline"
        >
          ← Domains
        </Link>

        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full border px-3 py-1">🔥 {streak}</span>
          <span className="rounded-full border px-3 py-1">⭐ {xp} XP</span>
          <span className="rounded-full border px-3 py-1">🎁 Day 3/7</span>
          <button
            onClick={() => {
              setAceMode("ask");
              setAceText(
                "Hi! I’m Ace. Tap “Ask Ace” during questions or tell me how you feel."
              );
              setAceOpen(true);
            }}
            className="rounded-full border px-3 py-1"
          >
            Ace
          </button>
        </div>
      </div>

      {/* Mission */}
      {step === "play" ? (
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="text-sm text-neutral-600 capitalize">
            {learnerId} • {domainId} • Mission
          </div>

          <h1 className="mt-2 text-2xl font-bold">Quick Mission</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Skill: {question.skill}
          </p>

          <div className="mt-6 rounded-2xl border p-5">
            <div className="text-lg font-semibold">{question.prompt}</div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {question.choices.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelected(c)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected === c ? "border-black" : "hover:shadow-sm"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {feedback && (
              <div className="mt-4 text-sm font-semibold">{feedback}</div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={submitAnswer}
                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
              >
                Check
              </button>

              <button
                onClick={openAceForAsk}
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
              >
                Ask Ace
              </button>

              <button
                onClick={openAceForHint}
                className="rounded-xl border px-4 py-2 text-sm"
              >
                Hint
              </button>
            </div>
          </div>

          {/* One-tap feelings */}
          <div className="mt-6 rounded-3xl border p-5">
            <div className="text-sm font-semibold">Need help?</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => openAceForFeeling("confused")}
                className="rounded-xl border px-4 py-2 text-sm text-left"
              >
                I’m confused
              </button>
              <button
                onClick={() => openAceForFeeling("frustrated")}
                className="rounded-xl border px-4 py-2 text-sm text-left"
              >
                I feel frustrated
              </button>
              <button
                onClick={() => openAceForFeeling("dont_know")}
                className="rounded-xl border px-4 py-2 text-sm text-left"
              >
                I don’t know what to do
              </button>
              <button
                onClick={() => openAceForFeeling("too_easy")}
                className="rounded-xl border px-4 py-2 text-sm text-left"
              >
                This is too easy
              </button>
              <button
                onClick={() => openAceForFeeling("too_hard")}
                className="rounded-xl border px-4 py-2 text-sm text-left"
              >
                This is too hard
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <div className="text-3xl">🎉</div>
          <h1 className="mt-2 text-2xl font-bold">Mission Complete!</h1>
          <p className="mt-1 text-sm text-neutral-600">
            You earned +10 XP and kept your streak going.
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Link
              href={`/learners/${learnerId}/domains/${domainId}`}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
            >
              Back to {domainId}
            </Link>

            <Link
              href={`/learners/${learnerId}/domains`}
              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
            >
              Choose another domain
            </Link>
          </div>
        </div>
      )}

      {/* Ace bubble modal */}
      {aceOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Ace</div>
              <button
                onClick={() => setAceOpen(false)}
                className="rounded-xl border px-3 py-1 text-sm"
              >
                Close
              </button>
            </div>

            <div className="mt-3 whitespace-pre-line text-sm leading-6">
              {aceText}
            </div>

            {aceMode === "ask" && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setAceOpen(false)}
                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
                >
                  Try again
                </button>
                <button
                  onClick={() => {
                    setAceText(
                      "Example: 8 + 6 → break 6 into 2 + 4.\n8 + 2 = 10, then +4 = 14.\n\nWant to try yours now?"
                    );
                  }}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold"
                >
                  One more example
                </button>
              </div>
            )}

            {aceMode === "feeling" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setAceMode("ask");
                    setAceText(
                      "Smaller one: What is 5 + 5?\nHint: 5 and 5 makes 10."
                    );
                  }}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold"
                >
                  Try a smaller one
                </button>
                <button
                  onClick={() => {
                    setAceMode("ask");
                    setAceText(
                      "Quick win: You’re doing great.\nLet’s do: 1 + 2.\nThat’s 3.\nNow back to your mission!"
                    );
                  }}
                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
                >
                  Take a quick win
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
