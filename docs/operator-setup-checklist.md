# Noraliva — Operator setup checklist

Single setup sprint so Cursor can handle preview URL retrieval, preview verification, and preview-only DB migrations with minimal manual relay from you.

---

## A. Vercel deployment access

**Purpose:** Agent (or you) gets the exact preview URL and status for any branch without opening Vercel.

| | |
|--|--|
| **Already done** | `scripts/get-preview-url.ts` exists. Reads `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and optionally `VERCEL_TEAM_ID` or `VERCEL_TEAM_SLUG`. Calls Vercel API, prints Branch / Status / URL / Commit. |
| **Still missing** | Env vars in `.env.local`: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and for team-scoped projects **one** of `VERCEL_TEAM_ID` or `VERCEL_TEAM_SLUG`. |
| **Minimum one-time setup** | Add the four (or three if personal project) env vars once. Get values: Vercel → Tokens (token), Project → Settings → General (project ID), Team → Settings → General or URL `teams/<slug>` (team id or slug). |
| **Who does it** | You (secrets never go in repo; agent cannot create tokens). |
| **Success condition** | Run `npm run preview:url -- preview/adaptive-skill-graph-memory-scheduler` → prints **Status: READY** and **URL: https://...** with no 404 or “project not found”. |

---

## B. Preview verification automation

**Purpose:** Agent runs a small set of checks against the live preview URL (e.g. session flow, plan generated) so you don’t have to click through every time.

| | |
|--|--|
| **Already done** | Playwright is in the repo; E2E runs against localhost. `get-preview-url` can supply the URL. |
| **Still missing** | A **verification script** that (1) takes the preview URL (env or CLI arg), (2) runs Playwright (or fetch) against that URL with a minimal flow (e.g. load app, optionally login, start session, request plan), (3) exits 0 on success, non‑zero on failure. Optional: env vars for a test learner so the script can log in. |
| **Minimum one-time setup** | (1) Agent adds the script. (2) You either set `PREVIEW_URL` when running (or agent passes URL from `preview:url` output), or you add `PREVIEW_VERIFICATION_LEARNER_EMAIL` / `PREVIEW_VERIFICATION_LEARNER_PASSWORD` once if you want logged-in checks. |
| **Who does it** | Agent implements the script. You add env vars only if you want authenticated verification. |
| **Success condition** | Run the verification script with a READY preview URL (e.g. `PREVIEW_URL=https://... npm run verify:preview` or pipe URL from `preview:url`) → script exits 0 and reports “verification passed”. |

---

## C. Preview database automation

**Purpose:** Agent can run migrations (and optional seed) against a **preview** Supabase instance only, so you don’t run SQL by hand for every preview branch.

| | |
|--|--|
| **Already done** | Migrations live in `supabase/migrations/`. You already apply production migrations manually (or via your own process). |
| **Still missing** | (1) A **preview** Supabase project (or a clear rule that “preview” = same project; then automation would apply to the same DB as production, which is riskier). (2) Credentials the agent can use: e.g. `SUPABASE_PREVIEW_URL` + `SUPABASE_PREVIEW_SERVICE_ROLE_KEY`, or Supabase CLI linked to that project. (3) A **script** that runs a given migration file (or `supabase db push`) against the preview project only. |
| **Minimum one-time setup** | You: Create a Supabase project for preview (recommended) or decide to reuse prod. Add to `.env.local` (or Cursor env): `SUPABASE_PREVIEW_URL`, `SUPABASE_PREVIEW_SERVICE_ROLE_KEY`. Agent: Add a script (e.g. `scripts/run-preview-migration.ts`) that reads one migration file and runs it via service role against `SUPABASE_PREVIEW_*`. |
| **Who does it** | You create the preview project and add the two env vars. Agent implements the migration runner script. |
| **Success condition** | Run the script with a migration path (e.g. `npm run preview:migrate -- supabase/migrations/00011_....sql`) → migration runs against the preview DB only; production DB unchanged. |

---

## Fastest implementation sequence (minimize your manual work)

1. **Batch env for Vercel (you, once)**  
   Add `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and `VERCEL_TEAM_ID` (or `VERCEL_TEAM_SLUG`) to `.env.local`. Run `npm run preview:url -- <branch>` and confirm you get READY + URL. No more “one missing var at a time” for Vercel.

2. **Preview verification script (agent)**  
   Add a script that takes the preview URL (env or arg), runs minimal checks (e.g. fetch or Playwright), exits 0/1. You can run it with `PREVIEW_URL=$(npm run preview:url -- <branch> | ...)` or set `PREVIEW_URL` manually when needed. Optional: you add test learner credentials once if you want logged-in verification.

3. **Preview DB (you + agent, when you need migration automation)**  
   When you’re ready: you create the preview Supabase project and add `SUPABASE_PREVIEW_URL` and `SUPABASE_PREVIEW_SERVICE_ROLE_KEY`. Agent adds the migration runner script. You run it only when a preview branch has new migrations.

This order removes the biggest repeated bottleneck first (preview URL), then adds verification without extra manual steps (agent implements; you only add URL or optional credentials), then adds DB automation only when you want it.

---

## Prioritization: reduce repeated manual steps first

- **High impact, low repeat:** Getting Vercel env right **once** so `preview:url` works every time (no more copying from dashboard).
- **High impact, no repeat:** Verification script run by agent (or you) whenever you have a preview URL; no need to manually click through the app each time.
- **Lower frequency:** Preview DB automation is only needed when there are new migrations on a preview branch; can be done after A and B.

---

## The 3 highest-leverage setup actions

1. **Add all Vercel env vars in one go**  
   In `.env.local`: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and either `VERCEL_TEAM_ID` or `VERCEL_TEAM_SLUG`. Run `npm run preview:url -- preview/adaptive-skill-graph-memory-scheduler` and confirm you see READY and a URL.

2. **Add the preview verification script and wire it to the preview URL**  
   Script that accepts `PREVIEW_URL` (env or CLI), runs minimal checks against that URL, exits 0 on success. Optional: you add `PREVIEW_VERIFICATION_LEARNER_EMAIL` and `PREVIEW_VERIFICATION_LEARNER_PASSWORD` once for logged-in checks.

3. **(When you want migration automation) Add preview Supabase + migration runner**  
   Create preview Supabase project, add `SUPABASE_PREVIEW_URL` and `SUPABASE_PREVIEW_SERVICE_ROLE_KEY`. Agent adds a script that runs a given migration file against that project only.

**Exact order to do them:** 1 → 2 → 3.

**Which one to implement first (agent):** **Preview verification script (action 2).**  
Vercel access (action 1) is already implemented; you only need to complete the env vars. The next thing that removes manual work is the verification script: once it exists, the agent (or you) can run it whenever a preview URL is available, without you clicking through the app. The migration runner (action 3) can follow when you’re ready to automate preview DB changes.
