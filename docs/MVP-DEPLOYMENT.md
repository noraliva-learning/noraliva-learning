# MVP Deployment — Noraliva Learning

This document defines the **canonical routes and configuration** for deploying the current system as an MVP. Use it for production checklists and Vercel configuration.

---

## 1. Canonical tutor route (Ask Ace)

- **Route:** `POST /api/v2/dan/help`
- **Behavior:** OpenAI Responses API, model `gpt-5-mini`, **streaming** response. Lesson context and chat history are sent in the request body. Every learner and tutor turn is written to `tutor_transcript`; parents can read via `/api/v2/transcript` and the transcript page.
- **Learner UI:** The only in-app tutor entrypoint is the “Ask Dan” panel in the session page, which calls this route only. The legacy `POST /api/v2/ace/help` route is **deprecated** and not used by the learner UI.

---

## 2. Learner routes

| Purpose              | Route / path                               | Method / type |
|----------------------|--------------------------------------------|---------------|
| Login                | `/v2/login`                                | Page          |
| Learner dashboard    | `/v2/learners/[slug]` (liv \| elle)        | Page          |
| Start learning       | `/v2/learn`                                | Page          |
| Start session        | `POST /api/v2/session/start`               | API           |
| Session (multi-Q)    | `/v2/learn/session/[sessionId]`            | Page          |
| Generate exercise    | `POST /api/v2/ai/generate-exercise`        | API           |
| Submit answer        | `POST /api/v2/session/submit-answer`       | API           |
| Ask Ace (tutor)      | `POST /api/v2/dan/help`                    | API (streaming) |

Flow: Login → Dashboard (`/v2/learners/liv` or `elle`) → Start session from `/v2/learn` → Session page loads → generate-exercise → submit-answer (per question) → mastery/transcript updated server-side. Tutor chat uses `POST /api/v2/dan/help` only.

---

## 3. Parent routes

| Purpose              | Route / path                | Method / type |
|----------------------|-----------------------------|---------------|
| Login                | `/v2/login`                 | Page          |
| Parent dashboard     | `/v2/parent`                | Page          |
| Tutor transcript     | `/v2/parent/transcript`     | Page          |
| Transcript API       | `GET /api/v2/transcript`     | API (query: learnerId, from, to) |

RLS: `can_access_learner(learner_id)` — parent sees only their children’s data; learner sees only their own. Transcript SELECT policy uses this; parent dashboard and transcript page use server/client that respect it.

---

## 4. Required environment variables

Set these in **Vercel** (and in `.env.local` for local dev):

| Variable                     | Required | Notes |
|-----------------------------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL`  | Yes      | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes  | Supabase anon/public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes*     | Server-only; for bootstrap/scripts. Never expose to client. |
| `OPENAI_API_KEY`            | For full MVP | Needed for tutor (`/api/v2/dan/help`) and AI exercise generation. If unset: tutor returns a friendly “AI unavailable” message; generate-exercise uses fallback math. |
| `OPENAI_DAN_MODEL`          | No          | Model for Responses API (default: `gpt-5-mini`). Override if your account uses a different model name. |
| `OPENAI_DAN_FALLBACK_MODEL` | No          | If Responses API fails (e.g. model not available), Dan falls back to Chat Completions with this model (default: `gpt-4o-mini`). |

\* Required for `npm run bootstrap:users` and any server-side admin; optional for the app at runtime if no such scripts run in production.

---

## 5. Build and test (CI parity)

```bash
npm run lint
npm run typecheck
npm run test
npm run build   # set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (e.g. placeholders for CI)
npm run test:e2e   # optional; requires real Supabase + test user for full run
```

---

## 6. Deployment readiness

- **Canonical tutor:** One route only in use: `POST /api/v2/dan/help` (Responses API, gpt-5-mini, streaming). Transcript logging and parent transcript access are implemented and RLS-protected.
- **Learner flow:** Login → dashboard → start session → multi-question session → submit-answer → mastery update and transcript logging are wired end-to-end.
- **Parent flow:** Login → dashboard → transcript page and API work with current RLS.
- **Build/tests:** Lint, typecheck, unit tests, and production build pass. E2E can be run with real env for full verification.

After setting the required env vars in Vercel and deploying, the system is **ready to deploy** for MVP use.
