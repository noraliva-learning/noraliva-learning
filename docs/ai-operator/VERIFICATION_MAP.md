# Noraliva Verification Map

**Source:** `package.json` scripts, Vitest config, Playwright config, and all `*.test.ts` / `*.spec.ts` / `e2e/*.spec.ts` in the repo.  
**Purpose:** Run commands, test coverage, gaps for the live learner session loop, and a fast bug-investigation checklist.

---

## 0. E2E learner authentication and stable test account (AI-native verification)

### How `TEST_LEARNER_EMAIL` and `TEST_LEARNER_PASSWORD` are used

- **Where:** `e2e/session-flow.spec.ts` reads them from `process.env` at test load time (Node/Playwright test process only).
- **Not in client:** These values are never bundled or sent to the browser; the test process fills the login form with them.
- **Behavior:** If either is missing, the whole "AI session flow" describe block is skipped (`test.skip(!learnerEmail || !learnerPassword, ...)`). When set, the test goes to `/v2/login`, fills the email/password inputs, clicks Sign in, then asserts redirect to `/v2/learners/liv`, `/v2/learners/elle`, or `/v2/parent`, then navigates to `/v2/learn` and runs the session flow (start session → question 1 → submit → next question → repeat).

### Stable E2E learner account

- **No test user is created by the app or by CI.** A stable learner account exists only if you create it in your Supabase project.
- **Additive path (recommended):** Run `npm run bootstrap:users` (see BOOTSTRAP.md). This creates Auth users and `profiles` rows for parent, **Liv**, and Elle. Liv is the intended stable E2E learner:
  - **Email:** `liv@noraliva.local`
  - **Password:** (bootstrap default) `BootstrapPassword1!` — change in Supabase or use a dedicated E2E password you set after first login.
- **Alternative:** Create a dedicated test learner in Supabase (Auth user + `profiles` row with `role = 'liv'` or `'elle'`) and use that email/password for E2E. Production auth flows are unchanged; the app only sees normal sign-in.

### Can current CI/local E2E run the full learner flow as-is?

- **Without `TEST_LEARNER_EMAIL` and `TEST_LEARNER_PASSWORD`:** No. The two "AI session flow" tests are skipped; only the home and v2 login reachability tests run.
- **With credentials set:** Yes, provided (1) the app is built, (2) the app’s Supabase env vars point at a project where that learner exists (e.g. after bootstrap), and (3) the test process has the two env vars (see below). Playwright loads `.env.local` into the test process so you can put them in `.env.local` and run without passing them in the shell.

### Exact env vars to set locally (for learner session E2E)

In **`.env.local`** (repo root), ensure you have (in addition to Supabase vars):

```bash
# Required for app (already in .env.example)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: E2E learner session tests only (test process; never in client)
TEST_LEARNER_EMAIL=liv@noraliva.local
TEST_LEARNER_PASSWORD=BootstrapPassword1!
```

Use the bootstrap Liv account (or your own test learner) and a strong password if you changed it. Do not commit `.env.local`.

### Exact command to run only the learner session E2E test

From repo root, after a production build:

```bash
npm run build
npx playwright test e2e/session-flow.spec.ts
```

With the above env vars in `.env.local`, Playwright will load them and the "AI session flow" tests will run (no need to pass them on the command line). To run only the two learner-flow tests (excluding home and login reachability):

```bash
npx playwright test e2e/session-flow.spec.ts -g "AI session flow"
```

### Final exact steps for local AI-native verification (full learner session E2E)

1. **Supabase:** Apply migrations to your Supabase project (e.g. `supabase db push` or run migration SQL).
2. **Bootstrap users:** `npm run bootstrap:users` (creates parent, Liv, Elle with default password; see BOOTSTRAP.md).
3. **Env:** In `.env.local` set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and for E2E optionally `TEST_LEARNER_EMAIL=liv@noraliva.local`, `TEST_LEARNER_PASSWORD=BootstrapPassword1!`.
4. **Build:** `npm run build`.
5. **Run learner session E2E:** `npx playwright test e2e/session-flow.spec.ts` (or `-g "AI session flow"` for only the two learner tests).

---

## 1. Run Commands

| Purpose | Command | Notes |
|--------|---------|--------|
| **Local dev server** | `npm run dev` | Runs `next dev` (Next.js dev server, default port 3000). |
| **Production build** | `npm run build` | Runs `next build`. Required before `npm run start` or E2E. |
| **Production server (local)** | `npm run start` | Runs `next start`. Playwright E2E uses this as the web server. |
| **Unit tests** | `npm run test` | Runs `vitest run`. No watch; single run. Matches `src/**/*.test.ts` and `src/**/*.spec.ts` (see Vitest config). |
| **E2E tests** | `npm run test:e2e` | Runs `npm run build && playwright test`. Builds the app, then runs Playwright; Playwright starts `npm run start` (or reuses existing server when not in CI). |
| **Lint** | `npm run lint` | Runs `next lint`. |
| **Type check** | `npm run typecheck` | Runs `tsc --noEmit`. |
| **Env check** | `npm run check:env` or `npm run env:check` | Runs `tsx scripts/check-env.ts`; validates Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY). |

**Vitest config** (`vitest.config.ts`): `environment: 'node'`, `include: ['src/**/*.test.ts', 'src/**/*.spec.ts']`, `globals: true`.  
**Playwright config** (`playwright.config.ts`): `testDir: './e2e'`, `baseURL: 'http://localhost:3000'`, `webServer: { command: 'npm run start', reuseExistingServer: !process.env.CI }`, single project Chromium.

---

## 2. Test Commands (Summary)

| Command | What it runs | When to use |
|---------|----------------|-------------|
| `npm run test` | All Vitest unit tests (sync) | After code changes to lib/ or API logic; no server needed. |
| `npm run test:e2e` | Full build + Playwright E2E | Before deploy or to verify full learner flow; needs build and (for learner tests) TEST_LEARNER_EMAIL / TEST_LEARNER_PASSWORD. |
| `npx playwright test e2e/smoke.spec.ts` | Smoke only (home + v2 login) | Quick check that app starts and key pages load; no auth. |
| `npx playwright test e2e/session-flow.spec.ts` | Session flow E2E | Full learner loop; **skipped** unless TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD are set. |

---

## 3. What Is Currently Covered

### 3.1 Unit tests (Vitest)

| File | What it verifies | Relevance to live learner session |
|------|------------------|-----------------------------------|
| `src/lib/mastery/masteryEngine.test.ts` | `updateMasteryFromCounts`, `scheduleNextReview`, `edgeOfLearningScore`, `isPromoted`, `isStruggling` | **High** — used inside `submitAttemptForSession` for mastery and review scheduling. |
| `src/lib/session/misconceptionClassifier.test.ts` | `classifyMisconception` (domain/skill → tag) | **Medium** — used when answer is wrong and no AI tag is provided. |
| `src/lib/session/sessionPlanUtils.test.ts` | `getSessionPlanIds` (array vs object-with-fallback) | **Low** — used by plan/next/attempt path, which is not used by current UI. |
| `src/lib/session/sessionPlanner.test.ts` | `buildSpiralMix`, `generateSessionPlan` | **Low** — used by plan route only; SessionFlow uses generate-exercise, not plan. |
| `src/app/api/v2/session/session-api.test.ts` | `getNextResponseSchema`, `generatePlanResponseSchema`, `getSessionPlanIds` round-trip | **Low** — contract for plan/next responses; live flow uses submit-answer + generate-exercise. |
| `src/lib/auth/getUserAppRole.test.ts` | `getDashboardPath` (parent → /v2/parent, liv → /v2/learners/liv, elle → /v2/learners/elle) | **Medium** — post-login redirect; no test of `getUserAppRole(supabase, user)` with real DB. |
| `src/lib/curriculum/nextExerciseLogic.test.ts` | `selectNextExercise`, `selectNextExerciseWithMastery` | **Low** — curriculum selection; not in the current generate-exercise → submit-answer loop. |

### 3.2 E2E tests (Playwright)

| File | Tests | Condition | Relevance |
|------|-------|-----------|-----------|
| `e2e/smoke.spec.ts` | Home page loads (title); v2 login page reachable (heading) | Always runs | Ensures app and v2 login are reachable; no auth. |
| `e2e/session-flow.spec.ts` | Home; v2 login reachable | Always | Same as smoke. |
| `e2e/session-flow.spec.ts` | **AI session flow** (login → /v2/learn → start session → see question 1 → submit answer → feedback → next question → repeat up to 5 steps); **session never ends due to missing content** (3 answers each yield next question) | **Skipped** unless `TEST_LEARNER_EMAIL` and `TEST_LEARNER_PASSWORD` are set | **High** — only E2E that exercises the live learner loop (generate-exercise + submit-answer). |

So: **the only tests that verify the live learner session loop are the two E2E tests in `session-flow.spec.ts` under "AI session flow", and they run only when test learner credentials are set.**

---

## 4. What Is Not Yet Covered

### 4.1 Live learner session loop (generate-exercise + submit-answer)

- **No unit tests** for:
  - `submitAttemptForSession` (attempts, attempt_misconceptions, skill_mastery, review_schedule writes).
  - `evaluateAnswer` (OpenAI or fallback; correct/misconception_tag/mastery_delta).
  - `getLearnerContextForGeneration` or `getOrCreateLessonForSkill`.
  - `/api/v2/ai/generate-exercise` or `/api/v2/session/submit-answer` route handlers (no route-level tests with mocked Supabase/OpenAI).
- **E2E:** Full loop is covered only when `TEST_LEARNER_EMAIL` and `TEST_LEARNER_PASSWORD` are set; in CI without those, the learner flow is **not** verified.

### 4.2 Session start

- No unit or E2E test for `POST /api/v2/session/start` or for `startLearningSession` (server action) creating a `learning_sessions` row and redirect.

### 4.3 Persistence

- No test that asserts an attempt row exists after submit-answer, or that skill_mastery / review_schedule are updated. E2E only asserts UI (feedback, next question); it does not query the DB.

### 4.4 Parent flow

- No test for parent dashboard loading or for `getParentViewData` returning children and attempts/mastery.

### 4.5 Plan/next/attempt path

- Unit tests cover schemas and session planner utils; there is no E2E or integration test that calls plan → next → attempt (this path is not used by the current UI).

### 4.6 Auth and role

- `getUserAppRole` with a real Supabase client is not tested; only `getDashboardPath` (pure function) is.

---

## 5. Commands to Run Before Deploying Learner-Session Changes

Recommended order (all from repo root):

1. **Env (if using Supabase in tests or E2E):**  
   `npm run check:env`  
   Ensures Supabase env vars are present.

2. **Unit tests:**  
   `npm run test`  
   Catches regressions in mastery engine, misconception classifier, session planner/utils, auth redirect, and session API schemas.

3. **Type and lint:**  
   `npm run typecheck`  
   `npm run lint`  
   Optional but recommended.

4. **Build:**  
   `npm run build`  
   Ensures the app builds; required for E2E.

5. **E2E (smoke, always):**  
   `npx playwright test e2e/smoke.spec.ts`  
   Verifies home and v2 login without credentials.

6. **E2E (full learner session, when credentials available):**  
   Put `TEST_LEARNER_EMAIL` and `TEST_LEARNER_PASSWORD` in `.env.local` (Playwright loads them into the test process), then:  
   `npx playwright test e2e/session-flow.spec.ts`  
   Or pass inline:  
   `TEST_LEARNER_EMAIL=liv@noraliva.local TEST_LEARNER_PASSWORD=... npx playwright test e2e/session-flow.spec.ts`  
   Or full E2E including build:  
   `npm run test:e2e` (learner tests run when env is set).

**Minimal pre-deploy set (no test learner account):**

```bash
npm run check:env
npm run test
npm run build
npx playwright test e2e/smoke.spec.ts
```

**Full pre-deploy set (with test learner account):**

Ensure `TEST_LEARNER_EMAIL` and `TEST_LEARNER_PASSWORD` are in `.env.local` (e.g. Liv from `npm run bootstrap:users`). Then:

```bash
npm run check:env
npm run test
npm run typecheck
npm run lint
npm run build
npx playwright test e2e/session-flow.spec.ts
```

---

## 6. Fast Bug Investigation Checklist

Use this when debugging learner-session issues (e.g. "no question", "submit fails", "wrong mastery", "session not found").

| Step | Action | Command / location |
|------|--------|--------------------|
| 1 | Confirm app runs | `npm run dev` → open http://localhost:3000, then /v2/login. |
| 2 | Confirm env | `npm run check:env`. If E2E: ensure TEST_LEARNER_EMAIL and TEST_LEARNER_PASSWORD are set. |
| 3 | Run unit tests (no server) | `npm run test`. Fix any failures in mastery, misconception, or session schemas first. |
| 4 | Session start | After login as learner, click Start session on /v2/learn. If 500/404, check `/api/v2/session/start` and `learning_sessions` insert (RLS, auth). |
| 5 | First question | Session page should show "Question 1" and an input. If "No content yet" or spinner forever, check `/api/v2/ai/generate-exercise`: context (session, domain, skills), OpenAI/key, fallback, and exercise insert. |
| 6 | Submit answer | Click Submit. If network error or 500, check `/api/v2/session/submit-answer`: session/exercise load, `evaluateAnswer`, `submitAttemptForSession`. |
| 7 | Persistence | If feedback shows but DB has no new attempt: check RLS (can_access_learner), Supabase client user, and `submitAttemptForSession` (attempts insert, then skill_mastery/review_schedule upsert). |
| 8 | Next question | After "Next question", if no new question or wrong one: SessionFlow calls generate-exercise again; check that it returns 200 and exerciseId + prompt. |
| 9 | E2E repro | Run E2E with learner credentials in `.env.local` or inline: `npx playwright test e2e/session-flow.spec.ts`. If it passes locally but fails in CI, diff env (e.g. missing TEST_LEARNER_* in CI). |
| 10 | Key files | See RUNTIME_FLOW_MAP.md: SessionFlow.tsx, submitAttemptForSession.ts, submit-answer route, generate-exercise route, getLearnerContextForAI.ts. |

**Frequent causes:**

- Missing or invalid `OPENAI_API_KEY`: generate-exercise and evaluateAnswer use fallbacks but can still error in some paths; E2E may see "No content yet" or submit-answer 500.
- RLS: learner must be `auth.uid()` or child of parent; wrong user or anon client will block inserts/updates.
- Session not found / forbidden: submit-answer and generate-exercise both validate session and `session.learner_id === user.id`; wrong sessionId or user causes 403/404.
- `session_plan` empty: Current UI expects empty plan and relies on generate-exercise every time; if something sets a non-empty plan and the UI ever switches to next/attempt, behavior would change (not a bug for current UI).
