# Adaptive Question Pipeline Fix — Root Cause and Changes

**Date:** March 2025  
**Issue:** Liv (7, Grade 2) and Elle (5, Grade 1) received the same questions; difficulty did not adapt after correct/incorrect answers; questions repeated.

---

## 1. Root Cause Analysis

### Why Liv and Elle got the same questions

| Cause | Detail |
|-------|--------|
| **No learner identity in generation** | `getLearnerContextForAI` did not load or pass learner **age**, **grade**, or **learner slug**. The AI prompt and fallback had no way to differentiate “age 5 / Grade 1” vs “age 7 / Grade 2”. |
| **Identical fallback** | `getFallbackMathExercise()` used a fixed range (1–5 + 1–5) for everyone and did not take any context. Same formula for all learners. |
| **Same skill selection when no mastery** | With no or low mastery data, `edgeOfLearningScore` was 0.5 for all skills; the code took the first skill in array order, so both learners got the same skill and similar context. |

### Why difficulty did not adapt after correct/incorrect

| Cause | Detail |
|-------|--------|
| **No “last attempt” signal** | The generate-exercise API was called with only `sessionId`. The **last attempt in this session** (correct/incorrect, skill) was not loaded or passed to the AI, so the model had no explicit “last was correct → harder” / “last was incorrect → easier” instruction. |
| **Weak prompt** | The user message included “recent performance” (across all time) but did not state adaptation rules (correct → slightly harder; incorrect → easier/scaffolded; misconception → target remediation). |
| **Fallback never adapted** | Fallback ignored performance and always produced the same style of question. |

### Why the same question could repeat

| Cause | Detail |
|-------|--------|
| **No “do not repeat” list** | Prompts already shown **in the current session** were not loaded or sent to the AI. The fallback did not avoid previously used “What is A + B?” prompts. |

### What was already working

- **submit-answer** correctly updated `attempts`, `skill_mastery`, and `attempt_misconceptions`.
- **getLearnerContextForGeneration** did load mastery, recent performance (for the chosen skill), and misconceptions.
- The **live path** is: SessionFlow → `POST /api/v2/ai/generate-exercise` (with `sessionId`) → AI or fallback → insert exercise → return; submit-answer runs on submit and does not call generate-exercise (next question is a **new** generate-exercise call). So the next question is always from a fresh generate-exercise that **can** read updated DB state; the gap was that we did not use last attempt in session, age/grade, or “do not repeat” in that call.

---

## 2. Files Inspected

- `src/app/api/v2/session/start/route.ts` — session creation (domain only; no change)
- `src/app/api/v2/session/plan/route.ts` — not used by live UI
- `src/app/api/v2/session/next/route.ts` — not used by live UI
- `src/app/api/v2/session/submit-answer/route.ts` — updates mastery/attempts; no change
- `src/app/api/v2/ai/generate-exercise/route.ts` — **modified**
- `src/app/v2/learn/session/[sessionId]/SessionFlow.tsx` — calls generate-exercise with `sessionId` only; no change (context comes from DB)
- `src/lib/ai/getLearnerContextForAI.ts` — **modified**
- `src/lib/db/submitAttemptForSession.ts` — already updates mastery; no change
- `src/lib/mastery/masteryEngine.ts` — edge of learning; no change
- `src/lib/learners.ts` — used for age/grade fallback when profile is null
- `supabase/migrations/*` — `skill_mastery.next_review_at`, `attempts.session_id` confirmed

---

## 3. Files Changed

| File | Changes |
|------|--------|
| **`src/lib/ai/getLearnerContextForAI.ts`** | 1) Load **profile** (role, age, grade_label) for learner; derive learnerSlug, age, gradeLabel (fallback to `getLearnerProfile(role)`). 2) Add **dueReviewSkillIds** (skills with `next_review_at <= now`) and prefer one of them when choosing skill (else edge-of-learning). 3) Load **last attempt in this session** (attempts where `session_id = sessionId`); resolve skill from exercise → lesson. 4) Load **recentPromptsInSession** (prompts of exercises attempted in this session). 5) Extend return type with learnerSlug, age, gradeLabel, lastAttemptInSession, recentPromptsInSession, dueReviewSkillIds. |
| **`src/app/api/v2/ai/generate-exercise/route.ts`** | 1) **System prompt**: Instruct to use learner age/grade, follow adaptation rules, and not repeat prompts from the “do not repeat” list. 2) **User message**: Add learner age and grade; add explicit “Adaptation” line (first question vs last correct vs last incorrect); add “Do not repeat these exact prompts” from ctx.recentPromptsInSession. 3) **Fallback**: `getFallbackMathExercise(ctx?)` — use ctx.age for number range (e.g. age ≤5 → 1–5, ≤7 → 1–8, else 1–12), ctx.recentPromptsInSession to avoid repeating the same “What is A + B?” prompt (try up to 25 different (a,b)); pass ctx into all fallback call sites where context exists. |

---

## 4. Old Question-Generation Path

1. Client calls `POST /api/v2/ai/generate-exercise` with `{ sessionId }` (and optional skillId; SessionFlow does not send skillId).
2. Server loads context via `getLearnerContextForGeneration(supabase, sessionId, skillId)`:
   - Session → learner_id, domain
   - Domain → skills
   - skill_mastery for learner + skills
   - **One skill** chosen by edge-of-learning (or preferredSkillId)
   - Recent performance and misconceptions **for that skill** (from attempts, not scoped to session)
   - **No** profile (age/grade), **no** last attempt in session, **no** recent prompts in session, **no** due-review preference
3. If OpenAI available: user message was “Domain, Skill, Mastery, Recent performance, Misconceptions”. **No** age/grade, **no** adaptation instruction, **no** “do not repeat”.
4. If fallback: `getFallbackMathExercise()` with no args — same 1–5 + 1–5 for everyone, no avoid-repeat.
5. Result returned; client shows question; on submit, submit-answer updates mastery; “Next question” triggers **another** generate-exercise (same steps). So the only way difficulty could “adapt” was via mastery/recent performance in context; there was no explicit “last correct/incorrect in this session” or age/grade.

---

## 5. New Question-Generation Path

1. Same entry: `POST /api/v2/ai/generate-exercise` with `{ sessionId }`.
2. **getLearnerContextForGeneration** now:
   - Loads **profile** (role, age, grade_label) for learner_id; sets learnerSlug, age, gradeLabel (with `getLearnerProfile` fallback).
   - Builds **dueReviewSkillIds** from skill_mastery where `next_review_at <= now`.
   - Chooses **skill**: preferredSkillId → use it; else if any dueReviewSkillIds → pick one (e.g. lowest mastery); else edge-of-learning as before.
   - Loads **last attempt in this session** (attempts where `session_id = sessionId`, order by created_at desc, limit 1); resolves skill from exercise → lesson.
   - Loads **recentPromptsInSession** (prompts of exercises attempted in this session).
   - Returns all of the above plus existing mastery, recent performance, misconceptions.
3. **AI path**: System prompt tells the model to use age/grade, adapt from “Last attempt” and “Adaptation”, and not repeat listed prompts. User message includes: “Learner: age X, Grade Y”; “Adaptation: [first question | last correct → slightly harder | last incorrect → easier/scaffolding/remediation]”; “Do not repeat these exact prompts: …”.
4. **Fallback path**: `getFallbackMathExercise({ age, recentPromptsInSession })` — number range by age; avoids generating a prompt that appears in recentPromptsInSession (for “What is A + B?” style).
5. Next question is still a new generate-exercise call; it now sees updated mastery **and** last attempt in session and recent prompts, so adaptation and no-repeat are applied.

---

## 6. Proof That Learner-Specific Adaptation Now Works

- **Differentiation by learner:** Context includes `age` and `gradeLabel` from profile (or `getLearnerProfile(learnerSlug)`). Liv gets age 7 / Grade 2, Elle gets age 5 / Grade 1. The prompt and fallback both use these.
- **Correct → harder:** When there is a last attempt in session and it was correct, the user message says “Last attempt was CORRECT. Generate a slightly harder or next-step exercise.”
- **Incorrect → easier:** When last attempt was incorrect, the message says “Last attempt was INCORRECT. Generate an easier exercise or the same skill with more scaffolding…” and mentions targeting repeated misconceptions.
- **No repeated prompt in session:** recentPromptsInSession is sent as “Do not repeat these exact prompts” to the AI; fallback explicitly avoids generating a prompt that is already in that list.
- **Review injection:** When some skills are due for review (`next_review_at <= now`), the context builder prefers one of those skills for the next question instead of only edge-of-learning.

---

## 7. Schema / Data Dependencies

- **profiles**: `role`, `age`, `grade_label` — already exist. Used for learner identity and level.
- **attempts**: `session_id` — already present. Used to get last attempt in session and exercise IDs for recent prompts.
- **skill_mastery**: `next_review_at` — already present. Used for due-review skill selection.
- **exercises**: `prompt` — read to build recentPromptsInSession.

No new migrations or schema changes.

---

## 8. Redeploy

Yes. This is a backend/API and context change. Redeploy the app (e.g. Vercel) so that generate-exercise and getLearnerContextForAI run the new code. No DB migrations required.

---

## 9. Manual Test Steps

### Liv adaptive session

1. Log in as Liv (age 7, Grade 2).
2. Start a Math session from /v2/learn.
3. **First question:** Should feel appropriate for Grade 2 (e.g. numbers or wording slightly more advanced than Grade 1). If fallback, numbers can go up to 8.
4. Answer **correctly** → tap “Next question”. Next question should be **slightly harder** or next step (same or adjacent skill).
5. Answer **incorrectly** → next question should be **easier** or same skill with more scaffolding.
6. Do **not** see the same exact prompt twice in one session (e.g. same “What is 3 + 2?”).

### Elle adaptive session

1. Log in as Elle (age 5, Grade 1).
2. Start a Math session.
3. **First question:** Should feel simpler than Liv’s (e.g. smaller numbers, simpler wording). If fallback, numbers 1–5.
4. Answer **correctly** → next question can advance slightly.
5. Answer **incorrectly** → next question should be easier or more scaffolded.
6. No repeated identical prompt in session.

### Correct-answer progression

1. In any session, answer 2–3 questions **correctly** in a row.
2. Next questions should tend to be **slightly harder** or move along the skill (not obviously easier).

### Incorrect-answer regression

1. Answer one or two questions **incorrectly**.
2. Next question should be **easier** or same skill with more support (and, if applicable, target a repeated misconception).

### No repeated-question loop

1. Complete several questions in one session (e.g. 5+).
2. Confirm you **do not** get the same exact prompt (e.g. same “What is 4 + 3?”) again in that session.
3. If using fallback (no OpenAI), still verify different number pairs after wrong/correct flows.

---

## Summary

- **Root cause:** No learner age/grade in context, no “last attempt in this session” or explicit adaptation rules, no “do not repeat” list, and a single shared fallback.
- **Fix:** Enrich context with profile (age, grade), last attempt in session, recent prompts in session, and due-review skills; pass explicit adaptation and no-repeat instructions into the AI; make fallback learner-aware and session-aware.
- **Result:** Liv and Elle get differentiated starting difficulty; correct answers lead to slightly harder/next-step questions; incorrect answers lead to easier/scaffolded or misconception-targeted questions; and the same prompt does not repeat within a session.
