"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import { getLearnerProfile } from "@/lib/learners";
import { getDailyMission, type Mission } from "@/lib/missions";
import { speak, stopSpeaking } from "@/components/AceVoice";
import AceFace from "@/components/AceFace";
import { playCorrect, playWrong, playCelebrate } from "@/lib/sounds";
import VoiceInput from "@/components/VoiceInput";

type Params = { learnerId: string; domainId: string };

type NodeStatus = "locked" | "ready" | "done";

type QuestNode = {
  id: string;
  title: string;
  subtitle: string;
  status: NodeStatus;
  predictedStruggle?: boolean;
};

type StoredState = {
  xp: number;
  streak: number;
  challengeDay: number; // 0..7
  committed: boolean;
  lastCompletedDate?: string; // YYYY-MM-DD
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function storageKey(learnerId: string, domainId: string) {
  return `noraliva:${learnerId}:${domainId}:state`;
}

function loadState(learnerId: string, domainId: string): StoredState {
  const raw = localStorage.getItem(storageKey(learnerId, domainId));
  if (!raw) return { xp: 0, streak: 0, challengeDay: 0, committed: false };
  try {
    return JSON.parse(raw) as StoredState;
  } catch {
    return { xp: 0, streak: 0, challengeDay: 0, committed: false };
  }
}

function saveState(learnerId: string, domainId: string, state: StoredState) {
  localStorage.setItem(storageKey(learnerId, domainId), JSON.stringify(state));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isYesterday(dateKey: string) {
  const d = new Date(dateKey + "T00:00:00");
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.toISOString().slice(0, 10) === y.toISOString().slice(0, 10);
}

function isToday(dateKey: string) {
  return dateKey === todayKey();
}

function formatDomain(domainId: string) {
  return domainId ? domainId[0].toUpperCase() + domainId.slice(1) : "Domain";
}

function softResetMessage(style: "strict" | "gentle") {
  return style === "strict"
    ? "We missed a day. That’s okay — want to start again today and keep the streak going?"
    : "We missed a day. That’s okay — we can keep going today. 💛";
}

export default function DomainPage({ params }: { params: Params }) {
  const learnerId = params.learnerId;
  const domainId = params.domainId;

  const learner = useMemo(() => getLearnerProfile(learnerId), [learnerId]);

  // UI state
  const [state, setState] = useState<StoredState>({
    xp: 0,
    streak: 0,
    challengeDay: 0,
    committed: false,
  });
  const [showAce, setShowAce] = useState(false);
  const [aceMode, setAceMode] = useState<
    | { type: "help"; context?: string }
    | { type: "feeling"; feeling: string }
    | { type: "feedback" }
    | null
  >(null);

  const [toast, setToast] = useState<string | null>(null);

  // “Mission” state
  const [mission, setMission] = useState<Mission | null>(null);
  const [missionOpen, setMissionOpen] = useState(false);
  const [missionLen, setMissionLen] = useState<1 | 3>(3); // ✅ NEW: 1-question or 3-question mission
  const [questionIdx, setQuestionIdx] = useState(0);
  const [lastMistakes, setLastMistakes] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean | null>(
    null
  );

  // Feedback inputs
  const [feedbackText, setFeedbackText] = useState("");
  const [thumb, setThumb] = useState<"up" | "down" | null>(null);
  const [wish, setWish] = useState<string | null>(null);

  const isMath = domainId === "math";
  const DOMAINS = ["math", "reading", "writing", "architecture", "spanish"];

  // Load + daily streak/challenge rules
  useEffect(() => {
    const loaded = loadState(learnerId, domainId);

    // If committed, enforce “missed day” logic (strict resets; gentle doesn’t hard reset)
    if (loaded.committed && loaded.lastCompletedDate) {
      if (
        !isToday(loaded.lastCompletedDate) &&
        !isYesterday(loaded.lastCompletedDate)
      ) {
        if (learner.challengeStyle === "strict") {
          loaded.challengeDay = 0;
          loaded.streak = 0;
          setToast(softResetMessage(learner.challengeStyle));
        } else {
          // gentle: keep streak modestly (or keep at 0 if you prefer)
          loaded.streak = clamp(loaded.streak, 0, 3);
          setToast(softResetMessage(learner.challengeStyle));
        }
      }
    }

    setState(loaded);
  }, [learnerId, domainId, learner.challengeStyle]);

  useEffect(() => {
    saveState(learnerId, domainId, state);
  }, [learnerId, domainId, state]);

  // Quest path nodes (Duolingo-style)
  const questNodes: QuestNode[] = useMemo(() => {
    const base: QuestNode[] = [
      { id: "warmup", title: "Warm-up", subtitle: "Easy start", status: "ready" },
      { id: "skill", title: "Skill", subtitle: "Today’s focus", status: "locked" },
      {
        id: "practice",
        title: "Practice",
        subtitle: "A few tries",
        status: "locked",
        predictedStruggle: true,
      },
      { id: "miniBoss", title: "Mini Boss", subtitle: "Show what you know", status: "locked" },
      { id: "celebrate", title: "Celebrate", subtitle: "Victory!", status: "locked" },
    ];

    if (!missionOpen) return base;

    const unlockCount = clamp(1 + Math.floor(questionIdx / 1), 1, base.length);
    return base.map((n, i) => {
      if (i < unlockCount - 1) return { ...n, status: "done" };
      if (i === unlockCount - 1) return { ...n, status: "ready" };
      return { ...n, status: "locked" };
    });
  }, [missionOpen, questionIdx]);

  // 7-day display
  const dayDisplay = useMemo(() => {
    const day = clamp(state.challengeDay, 0, 7);
    const checks = Array.from({ length: 7 }, (_, i) => i < day);
    return { day, checks };
  }, [state.challengeDay]);

  const missionLastIndex = missionLen - 1;
  const isLastQuestion = questionIdx >= missionLastIndex;

  const questions = mission?.questions ?? [];
  const currentQuestion = questions[questionIdx];

  // Speak question when it appears (kid-friendly TTS)
  const questionPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (!missionOpen || !currentQuestion?.prompt) return;
    if (questionPromptRef.current === currentQuestion.prompt) return;
    questionPromptRef.current = currentQuestion.prompt;
    speak(currentQuestion.prompt);
    return () => {
      stopSpeaking();
    };
  }, [missionOpen, currentQuestion?.prompt]);

  // Speak Ace helper response when Ace modal opens
  const aceBodyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showAce) {
      aceBodyRef.current = null;
      return;
    }
    const { body } = aceResponse();
    if (!body || aceBodyRef.current === body) return;
    aceBodyRef.current = body;
    speak(body);
  }, [showAce, aceMode, lastMistakes, currentQuestion?.prompt]);

  function openAce(payload: NonNullable<typeof aceMode>) {
    setAceMode(payload);
    setShowAce(true);
  }

  function closeAce() {
    setShowAce(false);
    setAceMode(null);
  }

  function startMission() {
    const daily = getDailyMission(learnerId, domainId, todayKey());
    setMission(daily);
    const desiredLen =
      daily.questions.length >= 3 ? 3 : 1; // keep missionLen in {1,3} but never exceed available
    setMissionLen(desiredLen as 1 | 3);
    setMissionOpen(true);
    setQuestionIdx(0);
    setSelectedAnswer(null);
    setAnsweredCorrectly(null);
  }

  function commit7Day() {
    setState((s) => ({ ...s, committed: true }));
    setToast("Committed! One mission a day. You’ve got this. ✅");
  }

  function completeMission() {
    const today = todayKey();

    setState((s) => {
      // If already completed today, don’t double count
      if (s.lastCompletedDate && isToday(s.lastCompletedDate)) return s;

      const nextStreak =
        s.lastCompletedDate && isYesterday(s.lastCompletedDate) ? s.streak + 1 : 1;

      const nextDay = s.committed ? clamp(s.challengeDay + 1, 0, 7) : s.challengeDay;

      const earnedXp = 25;

      return {
        ...s,
        xp: s.xp + earnedXp,
        streak: nextStreak,
        challengeDay: nextDay,
        lastCompletedDate: today,
      };
    });

    playCelebrate();
    setToast("Mission complete! 🎉 Nice work.");
    setMissionOpen(false);
    setAnsweredCorrectly(null);
    setSelectedAnswer(null);
    setQuestionIdx(0);
    setMissionLen(3);
  }

  function handleAnswer(idx: number) {
    if (!currentQuestion) return;

    setSelectedAnswer(idx);
    const correct = idx === currentQuestion.correctIndex;
    setAnsweredCorrectly(correct);

    if (correct) {
      playCorrect();
    } else {
      playWrong();
      setLastMistakes((m) => {
        const next = [currentQuestion.skill, ...m];
        return next.slice(0, 3);
      });
    }
  }

  function nextQuestion() {
    setQuestionIdx((n) => n + 1);
    setSelectedAnswer(null);
    setAnsweredCorrectly(null);
  }

  function aceResponse(): { title: string; body: string } {
    if (!aceMode) return { title: "Ace", body: "" };

    if (aceMode.type === "feeling") {
      const f = aceMode.feeling;
      if (f === "I feel frustrated") {
        return {
          title: "Ace",
          body: "You’re safe. We can do hard things.\n\nWant to do one tiny step… or take a quick win?",
        };
      }
      if (f === "I’m confused") {
        return {
          title: "Ace",
          body:
            "That makes sense. Let’s slow down.\n\nTell me what part feels confusing: the numbers, the words, or which button to press?",
        };
      }
      if (f === "I don’t know what to do") {
        return {
          title: "Ace",
          body: "No problem. Here’s the next step:\n\n1) Tap a card.\n2) We do one question.\n3) We celebrate. ✨",
        };
      }
      if (f === "This is too easy") {
        return {
          title: "Ace",
          body: "Love that. Want a harder one?\n\nI can make the numbers bigger or add a timer.",
        };
      }
      if (f === "This is too hard") {
        return {
          title: "Ace",
          body:
            "Okay. Let’s make it smaller.\n\nWe can do an easier one first, then come back stronger.",
        };
      }
    }

    if (aceMode.type === "help") {
      const mistakes = lastMistakes.length ? `I noticed: ${lastMistakes.join(" • ")}.\n\n` : "";
      return {
        title: "Ace",
        body:
          `${mistakes}Let’s do this one together:\n\n${
            currentQuestion?.prompt ?? ""
          }\n\nTip: Try counting up on your fingers.\nExample: 12 + 5 → 12…13,14,15,16,17.\n\nWant to try again, or want one more example?`,
      };
    }

    return {
      title: "Ace",
      body: "Tell me what felt confusing, and I’ll help right now — and I’ll remember it for next time.",
    };
  }

  function quickWin() {
    // ✅ Now actually changes the mission to 1 question
    setToast("Quick win mode! One easier question, then we celebrate. 🌟");
    setMissionLen(1);
    setQuestionIdx(0);
    setSelectedAnswer(null);
    setAnsweredCorrectly(null);
  }

  function smallerOne() {
    // ✅ Now actually changes the mission to 1 question
    setToast("Smaller step mode! One question today — then we celebrate. ✅");
    setMissionLen(1);
    setQuestionIdx(0);
    setSelectedAnswer(null);
    setAnsweredCorrectly(null);
  }

  function submitFeedback() {
    const payload = {
      when: new Date().toISOString(),
      learnerId,
      domainId,
      thumb,
      wish,
      feedbackText,
    };

    const key = `noraliva:feedback`;
    const existing = (() => {
      try {
        return JSON.parse(localStorage.getItem(key) || "[]") as any[];
      } catch {
        return [];
      }
    })();
    existing.unshift(payload);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 100)));

    setToast("Thanks! Ace saved that. ✅");
    setFeedbackText("");
    setThumb(null);
    setWish(null);
    closeAce();
  }

  if (!DOMAINS.includes(domainId)) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold">Unknown domain</h1>
        <p className="mt-2 text-sm text-neutral-600">This domain doesn’t exist yet.</p>
        <div className="mt-6">
          <Link href={`/learners/${learnerId}/domains`} className="underline">
            ← Back to domains
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/learners/${learnerId}/domains`}
              className="text-sm font-semibold text-neutral-800 hover:underline"
            >
              ← Domains
            </Link>
            <span className="text-sm text-neutral-400">|</span>
            <div className="text-sm font-semibold text-neutral-900">
              {learner.displayName} • {formatDomain(domainId)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border px-3 py-1 text-sm">
              🔥 <span className="font-semibold">{state.streak}</span>
            </div>
            <div className="rounded-full border px-3 py-1 text-sm">
              ⭐ <span className="font-semibold">{state.xp}</span> XP
            </div>
            <div className="hidden sm:flex rounded-full border px-3 py-1 text-sm">
              🎁{" "}
              <span className="ml-1">
                {state.committed ? `Day ${dayDisplay.day}/7` : "7-Day Quest"}
              </span>
            </div>

            {/* Ace bubble */}
            <button
              onClick={() => openAce({ type: "help", context: "topbar" })}
              className="relative rounded-full border bg-white px-3 py-1 text-sm font-semibold shadow-sm hover:shadow"
              aria-label="Ask Ace"
            >
              💬 Ace
            </button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="flex items-start justify-between rounded-2xl border bg-neutral-50 p-4 text-sm">
            <div className="whitespace-pre-line text-neutral-800">{toast}</div>
            <button
              className="ml-4 text-neutral-500 hover:text-neutral-900"
              onClick={() => setToast(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Headline + CTA */}
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-3xl font-extrabold tracking-tight">
                Today’s {isMath ? "Math" : formatDomain(domainId)} Mission
              </div>
              <div className="mt-2 text-sm text-neutral-600">
                Finish today’s mission to keep your 7-Day streak going!
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!state.committed ? (
                <button
                  onClick={commit7Day}
                  className="rounded-2xl border px-4 py-3 text-sm font-semibold hover:bg-neutral-50"
                >
                  🎁 Commit to 7 Days
                </button>
              ) : (
                <div className="rounded-2xl border px-4 py-3 text-sm">
                  <div className="font-semibold">
                    7-Day {isMath ? "Math" : formatDomain(domainId)} Quest
                  </div>
                  <div className="mt-1 text-neutral-600">Reward: Mystery Unlock 🎁</div>
                </div>
              )}

              <button
                onClick={startMission}
                className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:shadow"
              >
                🟢 Start Mission (5 minutes)
              </button>
            </div>
          </div>

          {/* 7-day progress */}
          {state.committed && (
            <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold">
                  {learner.id === "elle" ? "7-Day Star Trail" : "7-Day Math Quest"}
                </div>
                <div className="flex items-center gap-1">
                  {dayDisplay.checks.map((ok, i) => (
                    <span
                      key={i}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        ok ? "bg-green-600 text-white" : "bg-white text-neutral-500 border"
                      }`}
                      title={`Day ${i + 1}`}
                    >
                      {ok ? "✓" : i + 1}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-2 text-xs text-neutral-600">
                {learner.challengeStyle === "strict"
                  ? "Complete one mission each day. Missing a day resets — you can always restart with a smile."
                  : "Complete one mission each day. If you miss a day, we gently keep going. 💛"}
              </div>
            </div>
          )}
        </div>

        {/* Mini quest path + feelings */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border bg-white p-6 shadow-sm">
            <div className="text-lg font-bold">Mini Quest Path</div>
            <div className="mt-1 text-sm text-neutral-600">
              Tap a node to preview. Start Mission to play.
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {questNodes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (n.predictedStruggle)
                      openAce({ type: "help", context: `predicted struggle: ${n.title}` });
                    else setToast(`${n.title}: ${n.subtitle}`);
                  }}
                  className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                    n.status === "locked" ? "opacity-60" : "hover:shadow-sm"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{n.title}</span>
                      {n.predictedStruggle && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold">
                          💬 Ace
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-neutral-600">{n.subtitle}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {n.predictedStruggle && (
                      <span className="text-xs text-neutral-600">Ace can help</span>
                    )}
                    <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                      {n.status === "done"
                        ? "✅ Done"
                        : n.status === "ready"
                        ? "➡️ Ready"
                        : "🔒 Locked"}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Feedback area */}
            <div className="mt-6 rounded-2xl bg-neutral-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold">Feedback</div>
                <button
                  onClick={() => openAce({ type: "feedback" })}
                  className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                >
                  🗣️ Tell Ace what was confusing
                </button>
              </div>
              <div className="mt-2 text-xs text-neutral-600">
                This will show up in the parent dashboard later (we’re logging it now).
              </div>
            </div>
          </div>

          {/* One-tap feelings */}
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="text-lg font-bold">Need help?</div>
            <div className="mt-1 text-sm text-neutral-600">One tap — Ace will help.</div>

            <div className="mt-4 grid gap-2">
              {[
                "I’m confused",
                "I feel frustrated",
                "I don’t know what to do",
                "This is too easy",
                "This is too hard",
              ].map((label) => (
                <button
                  key={label}
                  onClick={() => openAce({ type: "feeling", feeling: label })}
                  className="rounded-2xl border px-4 py-3 text-left text-sm font-semibold hover:bg-neutral-50"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-neutral-50 p-4 text-sm">
              <div className="font-semibold">Tip:</div>
              <div className="mt-1 text-neutral-700">
                If Ace pops up, you can choose:{" "}
                <span className="font-semibold">Try again</span> or{" "}
                <span className="font-semibold">One more example</span>.
              </div>
            </div>
          </div>
        </div>

        {/* Mission modal */}
        {missionOpen && currentQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-extrabold">
                    Mission: {formatDomain(domainId)}
                  </div>
                  <div className="mt-1 text-sm text-neutral-600">
                    Skill: <span className="font-semibold">{currentQuestion.skill}</span>
                  </div>
                </div>

                <button
                  onClick={() => setMissionOpen(false)}
                  className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-neutral-50 min-h-[44px] min-w-[44px]"
                  aria-label="Close"
                >
                  Close
                </button>
              </div>

              {/* Animated Ace face — reacts to answer */}
              <div className="mt-4 flex justify-center">
                <AceFace
                  mood={
                    answeredCorrectly === null
                      ? "idle"
                      : answeredCorrectly
                      ? "celebrating"
                      : "encouraging"
                  }
                  size="lg"
                />
              </div>

              <div className="mt-4 rounded-2xl border p-5">
                <div className="text-lg font-bold">{currentQuestion.prompt}</div>

                <div className="mt-4 grid gap-3">
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = selectedAnswer === idx;
                    const showResult = answeredCorrectly !== null && isSelected;

                    return (
                      <button
                        key={opt}
                        disabled={answeredCorrectly !== null}
                        onClick={() => handleAnswer(idx)}
                        className={`rounded-2xl border-2 px-5 py-4 text-left text-base font-semibold transition min-h-[52px] touch-manipulation ${
                          answeredCorrectly === null
                            ? "hover:bg-neutral-50 active:bg-neutral-100"
                            : showResult && answeredCorrectly
                            ? "border-green-500 bg-green-50 text-green-800"
                            : showResult && !answeredCorrectly
                            ? "border-amber-400 bg-amber-50 text-amber-900"
                            : "opacity-80"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* Help buttons — large touch targets for kids */}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => openAce({ type: "help", context: "in-question" })}
                    className="rounded-2xl bg-black px-5 py-3 text-base font-semibold text-white min-h-[48px] touch-manipulation"
                  >
                    Ask Ace
                  </button>
                  <button
                    onClick={() => setToast("Hint: Try counting up (or making a ten).")}
                    className="rounded-2xl border-2 px-5 py-3 text-base font-semibold hover:bg-neutral-50 min-h-[48px] touch-manipulation"
                  >
                    Hint
                  </button>

                  <div className="ml-auto flex items-center gap-2">
                    {answeredCorrectly === false && (
                      <button
                        onClick={() => openAce({ type: "feeling", feeling: "I feel frustrated" })}
                        className="rounded-2xl border-2 px-5 py-3 text-base font-semibold hover:bg-neutral-50 min-h-[48px] touch-manipulation"
                      >
                        I feel frustrated
                      </button>
                    )}
                  </div>
                </div>

                {/* Next / complete */}
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-neutral-600">
                    Question {questionIdx + 1} / {missionLen}
                  </div>

                  <div className="flex gap-2">
                    {answeredCorrectly === true ? (
                      isLastQuestion ? (
                        <button
                          onClick={completeMission}
                          className="rounded-2xl bg-green-600 px-5 py-2 text-sm font-semibold text-white"
                        >
                          Finish Mission 🎉
                        </button>
                      ) : (
                        <button
                          onClick={nextQuestion}
                          className="rounded-2xl bg-green-600 px-5 py-2 text-sm font-semibold text-white"
                        >
                          Next →
                        </button>
                      )
                    ) : answeredCorrectly === false ? (
                      <button
                        onClick={() => {
                          setSelectedAnswer(null);
                          setAnsweredCorrectly(null);
                        }}
                        className="rounded-2xl border-2 px-6 py-3 text-base font-semibold hover:bg-amber-50 border-amber-200 min-h-[48px] touch-manipulation"
                      >
                        Try again 💛
                      </button>
                    ) : (
                      <button
                        onClick={() => setToast("Pick an answer, then we’ll go!")}
                        className="rounded-2xl border-2 px-6 py-3 text-base font-semibold hover:bg-neutral-50 min-h-[48px] touch-manipulation"
                      >
                        Next →
                      </button>
                    )}
                  </div>
                </div>

                {/* Elle-friendly “smaller step” mode */}
                {learner.id === "elle" && (
                  <div className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm">
                    <div className="font-semibold">Elle Mode 💛</div>
                    <div className="mt-1 text-neutral-700">
                      If it feels hard, we can do just{" "}
                      <span className="font-semibold">one</span> question today.
                    </div>
                    <div className="mt-2">
                      <button
                        onClick={smallerOne}
                        className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                      >
                        Try a smaller one
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 text-xs text-neutral-500">
                (This mission is a placeholder. Next we’ll generate questions per child, per skill, from your curriculum rules.)
              </div>
            </div>
          </div>
        )}

        {/* Ace modal */}
        {showAce && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AceFace mood="happy" size="sm" />
                  <div>
                    <div className="text-lg font-extrabold">💬 Ace</div>
                    <div className="mt-1 text-sm text-neutral-600">
                      Helper buddy (kid-safe)
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeAce}
                  className="rounded-xl border-2 px-4 py-2 text-sm font-semibold hover:bg-neutral-50 min-h-[44px] min-w-[44px]"
                  aria-label="Close"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 whitespace-pre-line rounded-2xl bg-neutral-50 p-4 text-base text-neutral-800">
                <div className="font-semibold">{aceResponse().title}</div>
                <div className="mt-2">{aceResponse().body}</div>
              </div>

              {/* Special action buttons when frustrated */}
              {aceMode?.type === "feeling" && aceMode.feeling === "I feel frustrated" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      smallerOne();
                      closeAce();
                      if (!missionOpen) startMission();
                    }}
                    className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
                  >
                    Try a smaller one
                  </button>
                  <button
                    onClick={() => {
                      quickWin();
                      closeAce();
                      if (!missionOpen) startMission();
                    }}
                    className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Take a quick win
                  </button>
                </div>
              )}

              {/* Feedback UI */}
              {aceMode?.type === "feedback" && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setThumb("up")}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                        thumb === "up" ? "bg-green-50 border-green-600" : "hover:bg-neutral-50"
                      }`}
                    >
                      👍
                    </button>
                    <button
                      onClick={() => setThumb("down")}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                        thumb === "down" ? "bg-red-50 border-red-600" : "hover:bg-neutral-50"
                      }`}
                    >
                      👎
                    </button>
                    <div className="text-sm text-neutral-600">This game was…</div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      "More examples",
                      "Slower steps",
                      "Harder questions",
                      "More games",
                      "Too many words",
                      "Too much time",
                    ].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setWish(opt)}
                        className={`rounded-2xl border px-4 py-2 text-left text-sm font-semibold ${
                          wish === opt ? "bg-neutral-50" : "hover:bg-neutral-50"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 items-start">
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Tell Ace what was confusing… (or tap the mic to speak)"
                      className="flex-1 min-h-[48px] rounded-2xl border-2 border-neutral-200 p-3 text-base outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                      rows={4}
                    />
                    <VoiceInput
                      onResult={(text) => setFeedbackText((prev) => (prev ? `${prev} ${text}` : text))}
                      largeTouchTarget
                      className="shrink-0"
                    />
                  </div>

                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={submitFeedback}
                      className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* In-the-moment help options */}
              {aceMode?.type === "help" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      closeAce();
                      if (!missionOpen) startMission();
                    }}
                    className="rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
                  >
                    Try again
                  </button>
                  <button
                    onClick={() => setToast("One more example: 7 + 8 → 7 + 3 = 10, then +5 = 15")}
                    className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    One more example
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
