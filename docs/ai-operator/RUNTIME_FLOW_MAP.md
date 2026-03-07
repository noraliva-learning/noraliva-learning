# Noraliva Runtime Flow Map

**Source:** App router pages, API routes, server actions, and lib usage in `src/`.  
**Purpose:** Reference for debugging and understanding which code participates in learner session, parent dashboard, and critical write paths.

---

## 1. Main Learner Flow (Homepage to Session)

Two distinct flows exist; only the **V2 auth flow** uses the database and API.

### 1.1 Root homepage → Legacy learner path (no auth, no DB)

- **Entry:** `src/app/page.tsx` — links to `/learners/liv` and `/learners/elle` (hardcoded).
- **Learner page:** `src/app/learners/[learnerId]/page.tsx` — static "Choose a domain" link to `/learners/{id}/domains`.
- **Domains:** `src/app/learners/[learnerId]/domains/page.tsx` — links to `/learners/{id}/domains/{domainId}`.
- **Domain page:** `src/app/learners/[learnerId]/domains/[domainId]/page.tsx` — full UI with 7-day quest, missions from `getDailyMission()` (lib), **localStorage** for state (xp, streak, challengeDay). No session API; no attempts in DB.
- **Mission page (alternate):** `src/app/learners/[learnerId]/domains/[domainId]/mission/page.tsx` — single static question (7+5), localStorage XP/streak, no API.

**Conclusion:** This path does **not** start a `learning_sessions` row or persist attempts. It is a prototype/placeholder.

### 1.2 V2 auth flow (DB + API)

- **Entry:** User goes to `/v2/login` (no link from root page; must be bookmarked or typed).
- **Login:** `src/app/v2/login/page.tsx` — `signInWithPassword` → `getUserAppRole()` → redirect to `getDashboardPath()`:
  - Parent → `/v2/parent`
  - Learner (liv | elle) → `/v2/learners/{slug}`
- **Learner dashboard:** `src/app/v2/learners/[slug]/page.tsx` — checks slug is liv|elle and that `getUserAppRole(supabase, user).learnerSlug === slug`. Starts session via **server action** `startLearningSession(domain)` → `src/lib/db/startSession.ts` (inserts `learning_sessions`), then `router.push(/v2/learn/session/${sessionId})`.
- **Alternative learner entry:** `src/app/v2/learn/page.tsx` — domain dropdown, then `POST /api/v2/session/start` with `{ domain }`; on success redirects to `/v2/learn/session/${data.sessionId}`. No path choice; session created with `session_plan: []`, `current_index: 0`.
- **Session page:** `src/app/v2/learn/session/[sessionId]/page.tsx` — server component: loads session and profile, checks `session.learner_id === user.id`, renders `SessionFlow`.
- **SessionFlow:** `src/app/v2/learn/session/[sessionId]/SessionFlow.tsx` — client:
  - **Always** uses **AI question flow:** calls `POST /api/v2/ai/generate-exercise` with `{ sessionId }` to get next question (no call to `/api/v2/session/plan` or `/api/v2/session/next`).
  - On submit, `SessionQuestion` calls `POST /api/v2/session/submit-answer` with `{ sessionId, exerciseId, learnerAnswer }`.
  - On feedback, "Next question" calls generate-exercise again; "End Session" calls `endLearningSession(sessionId)` (server action) then navigates to `/v2/learners/{slug}`.

**Conclusion:** The only live DB-backed learner session path is: **V2 login → learner dashboard or v2/learn → session start (API or server action) → session page → SessionFlow (generate-exercise loop + submit-answer)**. The planned-session path (plan → next → attempt) is **not** used by any UI.

---

## 2. Parent / Admin Flow

- **Entry:** After login as parent, `getDashboardPath` sends to `/v2/parent`.
- **Parent dashboard:** `src/app/v2/parent/page.tsx` — client: `getUserAppRole`; if learner, redirect to learner dashboard. Loads profile and calls **server action** `getParentViewData()` from `src/lib/db/getParentViewData.ts`.
- **getParentViewData:** Fetches profiles where `parent_id = user.id`, then for each child: attempts (with exercise prompt), skill_mastery (with skill name). Returns `ChildProgress[]` for display.
- **UI:** Lists each child with recent attempts and skill mastery; links to "Go to Learn session" (`/v2/learn`) and "Back to prototype home" (`/`). No parent-specific session start; parent can use same learn entry as learner for testing.

**Note:** There is no separate "admin" role in the schema; "admin" here means parent view only.

---

## 3. Critical Routes and What Each Does

| Route | Method | Purpose |
|-------|--------|---------|
| **/api/v2/session/start** | POST | Creates one `learning_sessions` row (learner_id, domain, status=active, session_plan=[], current_index=0). Returns `{ sessionId }`. Used by v2/learn page. |
| **/api/v2/session/plan** | POST | Body: `{ sessionId, path }`. Loads session, calls `loadSessionPlanData` + `generateSessionPlan`, **updates** `learning_sessions` (path, session_plan, current_index=0). Returns `{ exerciseIds, planLength }`. **Not called by any current UI.** |
| **/api/v2/session/next** | GET | Query: `sessionId`. Returns current exercise from `session_plan[current_index]` (prompt, exerciseId, index, total). **Not called by any current UI.** |
| **/api/v2/session/attempt** | POST | Body: `{ sessionId, exerciseId, correct, masteryDelta?, misconceptionTag? }`. Validates session and plan step; calls `submitAttemptForSession`; **updates** `learning_sessions.current_index`; returns nextStep, masteryLevel, microLesson, etc. **Not called by any current UI.** |
| **/api/v2/session/submit-answer** | POST | Body: `{ sessionId, exerciseId, learnerAnswer }`. Loads exercise (correct_answer), calls `evaluateAnswer()` (OpenAI or fallback), then `submitAttemptForSession(..., evaluation.correct, { masteryDelta, misconceptionTag })`. Returns correct, masteryLevel, microLesson, nextStep, encouragementMessage, dueReviewsCount. **Used by SessionQuestion (V2 session flow).** |
| **/api/v2/ai/generate-exercise** | POST | Body: `{ sessionId, skillId? }`. Loads session and learner context via `getLearnerContextForGeneration`; optionally creates lesson via `getOrCreateLessonForSkill`; calls OpenAI or fallback; **inserts** exercise into `exercises`; returns prompt, answer_type, correct_answer, hints, exerciseId, skillId. **Used by SessionFlow for every question.** |
| **/api/v2/ai/evaluate-answer** | POST | Body: `{ learnerAnswer, correctAnswer, prompt, skillId, learnerId }`. Auth check learnerId === user.id; calls `evaluateAnswer()` only; returns evaluation JSON. **Does not persist.** Used for standalone evaluation (e.g. testing); submit-answer uses evaluateAnswer internally and persists. |

---

## 4. Participation Matrix: Who Does What

### 4.1 Learner selection

- **Route handlers:** None (selection is by auth + URL slug).
- **Server actions:** None for "selection"; session start uses current user as learner.
- **Lib:** `src/lib/auth/getUserAppRole.ts` — resolves role and learner slug from profile (or email prefix). `getDashboardPath()` returns `/v2/parent` or `/v2/learners/{slug}`. Used by login and parent/learner pages to redirect.

### 4.2 Session launch

- **Route handlers:** `src/app/api/v2/session/start/route.ts` — POST, inserts `learning_sessions`.
- **Server actions:** `src/lib/db/startSession.ts` — `startLearningSession(domain)` inserts `learning_sessions` (no session_plan in payload; DB default used).
- **Lib:** None beyond Supabase client.

### 4.3 Question generation

- **Route handlers:** `src/app/api/v2/ai/generate-exercise/route.ts` — loads context, calls OpenAI or fallback, inserts exercise.
- **Server actions:** None.
- **Lib:** `src/lib/ai/getLearnerContextForAI.ts` — `getLearnerContextForGeneration()` (session, domain, skills, mastery, attempts, misconceptions), `getOrCreateLessonForSkill()` (ensures lesson for skill; may insert into `lessons`). Used only by generate-exercise route.

### 4.4 Answer evaluation

- **Route handlers:** `src/app/api/v2/session/submit-answer/route.ts` — calls `evaluateAnswer()` then `submitAttemptForSession`. `src/app/api/v2/ai/evaluate-answer/route.ts` — calls `evaluateAnswer()` only (no persistence).
- **Server actions:** None.
- **Lib:** `src/lib/ai/evaluateAnswer.ts` — `evaluateAnswer({ learnerAnswer, correctAnswer, prompt })`; OpenAI or string-match fallback; returns correct, misconception_tag, mastery_delta, encouragement_message.

### 4.5 Persistence of attempts

- **Route handlers:** submit-answer route calls `submitAttemptForSession`; attempt route (unused by UI) also calls it.
- **Server actions:** None that insert attempts directly.
- **Lib:** `src/lib/db/submitAttemptForSession.ts` — inserts into `attempts` (learner_id, exercise_id, correct, session_id); on wrong answer calls `insertAttemptMisconception` from `src/lib/db/misconceptions.ts` (inserts `attempt_misconceptions`).

### 4.6 Mastery updates

- **Route handlers:** Same as 4.5 (submit-answer and attempt both go through submitAttemptForSession).
- **Server actions:** None.
- **Lib:** `src/lib/db/submitAttemptForSession.ts` — upserts `skill_mastery` (level, mastery_probability, confidence_score, attempts_count, last_attempt_at, next_review_at, spaced_check_count). Uses `src/lib/mastery/masteryEngine.ts` — `updateMasteryFromCounts`, `scheduleNextReview`. Also upserts `review_schedule` (next_review_at).

### 4.7 Parent progress display

- **Route handlers:** None (data via server action).
- **Server actions:** `src/lib/db/getParentViewData.ts` — `getParentViewData()` fetches children (profiles where parent_id = user.id), then for each: attempts (join exercises for prompt), skill_mastery (join skills for name). Used by `src/app/v2/parent/page.tsx`.

---

## 5. Current Live Entry Points

- **Unauthenticated:**  
  - `/` — Homepage; links to `/learners/liv`, `/learners/elle` only (legacy path).  
  - No link to `/v2/login` from homepage.

- **Authenticated (after /v2/login):**  
  - **Parent:** Redirect to `/v2/parent`. From there: "Go to Learn session" → `/v2/learn` (starts session as the parent user if they click Start — no child impersonation).  
  - **Learner (liv | elle):** Redirect to `/v2/learners/liv` or `/v2/learners/elle`. From there: domain button → `startLearningSession(domain)` → `/v2/learn/session/{sessionId}`.  
  - **Direct:** `/v2/learn` — any authenticated user can start a session (no learner slug check); session is tied to `user.id`.

- **Session:**  
  - Only way to get a session page is: (1) v2/learners/[slug] → start session (server action) → redirect, or (2) v2/learn → POST /api/v2/session/start → redirect.  
  - Session page loads session from DB, verifies `session.learner_id === user.id`, then renders SessionFlow (generate-exercise + submit-answer only).

---

## 6. Placeholder / Legacy Paths

- **Root homepage links:** Point to `/learners/liv` and `/learners/elle` (no auth). These lead to static/legacy flows that do **not** use `learning_sessions` or persist attempts.

- **Learners/[learnerId] and domains:** Static or localStorage-only. `learners/[learnerId]/domains/[domainId]/page.tsx` uses `getDailyMission()` (from `@/lib/missions`), localStorage for XP/streak; no API session, no attempt persistence. `mission/page.tsx` is a single static question with localStorage.

- **Planned-session API (plan, next, attempt):** Implemented and tested but **not wired in the UI**. SessionFlow never calls `/api/v2/session/plan`, `/api/v2/session/next`, or `/api/v2/session/attempt`. So path choice (level_up vs review), precomputed session_plan, and current_index advancement for planned exercises are unused. The only live flow is: empty session_plan → generate-exercise on each step → submit-answer (which uses AI evaluation and then submitAttemptForSession with masteryDelta/misconceptionTag).

- **/api/v2/ai/evaluate-answer:** Standalone evaluation endpoint; no caller in the app for the normal flow (submit-answer uses evaluateAnswer lib directly and then persists). Useful for tests or external tools.

- **liv/page.tsx:** Single static "Liv's learning dashboard will live here" — no navigation to session or domains.

---

## 7. Likely Bug Hotspots

1. **Session start vs session_plan:** `startSession.ts` (server action) does not set `session_plan` or `current_index` in the insert. The DB default (e.g. `session_plan = '[]'`) may apply; if not, SessionFlow’s generate-exercise path does not depend on session_plan (it uses empty plan and AI generation). Inconsistency could matter if the app later switches to plan/next/attempt.

2. **Two session start paths:** (a) POST /api/v2/session/start (sets session_plan: [], current_index: 0 explicitly), (b) `startLearningSession(domain)` server action (does not set them). Both create a row; behavior should be aligned for future use of plan/next.

3. **SessionFlow always AI, no path choice:** User never sees "Level Up" vs "Review"; plan is never generated. If product expects a mix of planned vs AI-only sessions, the UI does not support it yet.

4. **Parent "Go to Learn session":** From parent dashboard, "Go to Learn session" links to `/v2/learn`. That page starts a session for the **currently logged-in user** (the parent). So parent does not "start a session for Liv/Elle"; they would be starting a session as themselves (and profiles may not have a learner role for that user). Likely UX bug unless parent is expected to share device and not start sessions.

5. **Learner slug vs user.id:** Learner dashboard (`/v2/learners/[slug]`) verifies `getUserAppRole(...).learnerSlug === slug` and then starts a session with `user.id` as learner_id. Correct. But `/v2/learn` does not check role — any authenticated user can start a session. If a parent hits `/v2/learn` by URL, they create a session with learner_id = parent’s user.id (wrong learner_id for reporting).

6. **generate-exercise and missing OPENAI_API_KEY:** When OPENAI_API_KEY is missing, generate-exercise returns fallback exercise and may still insert an exercise row. SessionFlow treats non-ok response as "empty" and shows "No content yet". So missing key leads to fallback insert in some code paths but could also hit error handling that doesn’t return 200 — worth verifying behavior when key is unset.

7. **submit-answer and evaluateAnswer failure:** If `evaluateAnswer` throws or OpenAI fails, submit-answer catches and returns 500. Client shows generic error; no attempt is persisted. So a transient API failure means lost attempt unless retried.

8. **getParentViewData N+1:** Fetches attempts then for each attempt fetches exercise prompt; fetches mastery then for each skill fetches skill name. Fine for small data; could be slow for many attempts/skills.

9. **End session:** `endLearningSession` only sets status=completed and ended_at. It does not advance or fix session_plan/current_index. For the current AI-only flow this is fine.

---

## 8. File Reference (Key Paths)

- **Auth / role:** `src/lib/auth/getUserAppRole.ts`  
- **Session start (API):** `src/app/api/v2/session/start/route.ts`  
- **Session start (server action):** `src/lib/db/startSession.ts`  
- **Session end:** `src/lib/db/endSession.ts`  
- **Generate question:** `src/app/api/v2/ai/generate-exercise/route.ts`, `src/lib/ai/getLearnerContextForAI.ts`  
- **Evaluate answer:** `src/lib/ai/evaluateAnswer.ts`  
- **Submit answer (API):** `src/app/api/v2/session/submit-answer/route.ts`  
- **Persist attempt + mastery + review:** `src/lib/db/submitAttemptForSession.ts`, `src/lib/mastery/masteryEngine.ts`, `src/lib/db/misconceptions.ts`  
- **Parent data:** `src/lib/db/getParentViewData.ts`, `src/app/v2/parent/page.tsx`  
- **Session UI:** `src/app/v2/learn/session/[sessionId]/page.tsx`, `SessionFlow.tsx`, `SessionQuestion.tsx`, `SessionActions.tsx`
