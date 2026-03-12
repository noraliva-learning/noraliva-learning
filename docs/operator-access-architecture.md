# Noraliva — AI-Operator Access Architecture

**Goal:** Enable the AI agent to perform verification and deployment workflows end-to-end with minimal human intervention, by giving it the minimum access needed to overcome current blocks.

**Scope:** Operator-access design only. No code or deployment changes in this document.

---

## 1. Missing capabilities for full automation

| # | Capability | Current block | Needed for |
|---|------------|----------------|------------|
| 1 | **Supabase admin execution** | No credentials, no linked project, no way to run SQL or `supabase db push` | Apply migrations on preview; seed test data; verify DB state (e.g. prerequisite rows, mastery) |
| 2 | **Vercel preview URL / deployment inspection** | No Vercel API token or GitHub deployment API; no PR so no bot link to scrape | Get exact preview URL after push; confirm deployment status (Ready/Failed) |
| 3 | **Browser-based preview verification** | No browser automation against a live URL; E2E is localhost-only | Run session flow (start → plan → attempt) on preview; verify locked/unlocked with seed data |

---

## 2. Per-capability: access needed, safety, minimum setup

### 2.1 Supabase admin execution

**What access/tool is needed**

- **Option A — Supabase CLI (linked):**  
  - `supabase link --project-ref <ref>` (one-time) using a **project ref** and **database password** (or service role).  
  - Then: `supabase db push` to apply migrations; no direct SQL from the agent unless we add a “run this SQL file” step that uses the linked project.
- **Option B — Direct SQL execution:**  
  - A **Supabase service-role key** (or a dedicated “automation” role with limited privileges) and the **project URL**, so the agent can run idempotent SQL (migrations, seed scripts) via the Supabase REST API or a small script that uses `@supabase/supabase-js` with the service role.
- **Option C — CI job (e.g. GitHub Actions):**  
  - A workflow that runs on the preview branch, uses **Supabase project ref + secrets** (e.g. `SUPABASE_ACCESS_TOKEN` for Management API, or DB URL for migrations), runs `supabase db push` or a migration script. The agent triggers the workflow (e.g. by pushing) and reads the job output; it does not hold DB credentials itself.

**Can it be done safely?**

- **Yes, with constraints.**  
  - Use a **separate Supabase project for preview** (or a preview branch / schema) so production DB is never touched by automation.  
  - Restrict automation to: run migrations under `supabase/migrations/`, run a fixed seed script (e.g. prerequisite seed), and read-only checks. No ad-hoc arbitrary SQL from the agent.  
  - Store credentials in **environment secrets** (e.g. GitHub Secrets, Cursor / runner env), never in repo or in agent context.

**Minimum setup**

- One-time:  
  - Create **Supabase project for preview** (or decide “preview uses same project, different branch” and accept risk).  
  - Store **project ref** and **database password** (or **service role key**) in a secret store the runner can use (e.g. GitHub Secrets: `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` or `SUPABASE_SERVICE_ROLE_KEY`).  
  - If using CLI: install Supabase CLI in the runner and run `supabase link` using those secrets (or use `--project-ref` + env for password).  
  - If using direct SQL: a small script in the repo (e.g. `scripts/run-migration.ts`) that reads migration file path, connects with service role, runs the SQL; agent invokes the script with the migration path.  
- Per-run: agent runs “apply migration 00011” by either (a) triggering a job that runs `supabase db push`, or (b) running the script with the migration file.

---

### 2.2 Vercel preview URL / deployment inspection

**What access/tool is needed**

- **Vercel API:**  
  - **Vercel API token** (e.g. from Vercel → Settings → Tokens) with read access to the project.  
  - Agent (or a script it invokes) calls e.g. `GET /v6/deployments?projectId=...&target=preview` (or the deployments list API) filtered by branch `preview/adaptive-skill-graph-memory-scheduler`, then reads the **url** (preview URL) and **state** (READY, BUILDING, ERROR).  
- **GitHub API (optional):**  
  - If Vercel is connected to GitHub, **GitHub token** with repo read can be used to list workflow runs or check status; the **preview URL** itself usually still comes from Vercel (deployment comment or API). So the primary need is Vercel API.

**Can it be done safely?**

- **Yes.**  
  - Read-only token is enough (list deployments, read URL and status).  
  - Token stored as secret; agent only receives the preview URL string to use in verification, not the token.

**Minimum setup**

- One-time:  
  - Create a **Vercel API token** (read-only or minimal scope for the project).  
  - Store in runner secrets (e.g. `VERCEL_TOKEN`).  
  - Know **Vercel project ID** (or project name/team) for the Noraliva project.  
- Per-run: agent (or script) calls Vercel API: “latest deployment for branch X” → return `url` and `state`. Agent then uses `url` for verification step.

---

### 2.3 Browser-based preview verification

**What access/tool is needed**

- **Browser automation against a live URL:**  
  - **Playwright** (or similar) configured to use **baseURL = preview URL** (from step 2.2) and optionally **auth state** (e.g. stored learner session or test credentials).  
  - Script that: (1) navigates to preview URL, (2) logs in (or loads saved auth), (3) starts session, (4) generates plan, (5) optionally submits an answer and advances, (6) asserts no errors and (optionally) that plan contains expected skill/exercise.  
  - For “locked/unlocked” verification: run after seeding prerequisite; assert plan excludes dependent skill; then (via Supabase or API) set mastery ≥ 0.85; run again; assert plan includes dependent skill. That may require the agent to trigger Supabase (step 2.1) then re-run the browser flow.

**Can it be done safely?**

- **Yes, with constraints.**  
  - Runs only against **preview** URL, never production.  
  - Use **test/dedicated accounts** (e.g. a “verification” learner) so real users are unaffected.  
  - No destructive actions (e.g. delete user, purge DB) in the script.

**Minimum setup**

- One-time:  
  - **Playwright** (or existing E2E stack) extended with a **verification profile**: `baseURL` set from env (e.g. `PREVIEW_URL`), and auth either (a) test credentials in env, or (b) a saved auth state file generated once by a human.  
  - A **verification script** (e.g. `scripts/verify-preview.ts` or a Playwright test) that encodes the 3–5 checks (session flow, plan generated, optional locked/unlocked).  
  - Runner must be able to open a browser (or use headed/headless Playwright in CI).  
- Per-run: agent sets `PREVIEW_URL` from step 2.2, runs the verification script; script exits 0/1 and agent reads result.

---

## 3. Proposed operating model for Noraliva

**Principle:** Preview branch is the only target for automated migrations, seeding, and verification. Production (main) is updated only after human-approved merge; production migrations can remain manual or a separate, gated step.

**Workflow the agent would run (after setup):**

1. **Apply migrations on preview**  
   - When working on a preview branch that includes new migrations:  
     - Runner has access to **preview Supabase** (separate project or preview DB).  
     - Agent runs “apply migration 00011” by either:  
       - Triggering a job that runs `supabase db push` (with link to preview project), or  
       - Running a script that executes the migration SQL via service role.  
   - No production DB is touched.

2. **Retrieve preview deployment URL**  
   - After push to preview branch:  
     - Agent (or script) calls Vercel API with branch name → get latest deployment → read `url` and `state`.  
     - If `state !== READY`, wait or retry until READY or fail.  
     - Store or pass the preview URL to the next step.

3. **Run verification against preview**  
   - Agent sets `PREVIEW_URL` and runs the **verification script** (Playwright or equivalent):  
     - Session flow (start → plan → attempt) on preview.  
     - Optionally: seed prerequisite (via Supabase from step 1), run “locked” check, set mastery via API/Supabase, run “unlocked” check.  
   - Script success/failure is the verification result.

4. **Confirm merge readiness**  
   - If all automated checks pass (migrations applied, preview URL obtained, verification script passed):  
     - Agent reports “PASS 1 ready to merge” and prepares the merge (e.g. exact git commands or PR merge).  
   - **Merge itself remains a human-approved action** (you click merge or run the merge command after approval).

**Environments:**

- **Preview Supabase:** Dedicated project (or dedicated DB/schema) for preview branches. Migrations and seed data apply here only.  
- **Production Supabase:** Unchanged; migrations applied only after merge to main (or via a separate, gated process).  
- **Vercel:** One project; preview deployments per branch. Agent only reads deployment list and preview URL.

---

## 4. What can be automated now vs one-time setup vs approval

### Can be automated **now** (no new access)

- Lint, typecheck, unit tests (already run by the agent).  
- Building the app (`npm run build`).  
- Git operations on the preview branch (commit, push).  
- Producing the verification report and merge workflow text (already done).  
- **Not** possible without new access: applying migrations, getting preview URL, running browser verification.

### Requires **one-time setup**

| Capability | One-time setup |
|------------|----------------|
| **Supabase (preview)** | Create preview Supabase project (or schema); store `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD` or `SUPABASE_SERVICE_ROLE_KEY` in runner secrets; optionally add script `scripts/run-migration.ts` and wire agent to run it for a given migration file. Or: GitHub Action that runs `supabase db push` on preview branch using those secrets. |
| **Vercel** | Create Vercel API token (read); store `VERCEL_TOKEN` in runner secrets; store `VERCEL_PROJECT_ID` (or equivalent) in env; add script or inline step that calls Vercel API to get latest deployment for branch and returns URL + state. |
| **Browser verification** | Add verification script (Playwright) that takes `PREVIEW_URL` and optional auth env; encode PASS 1 checks (session flow, optional locked/unlocked). Ensure runner can run Playwright (local or CI). Optionally: create a “verification” learner and store credentials or auth state. |

### Should still require **your approval**

- **Merge to main** — always. Agent should only propose the merge (e.g. “run these commands” or “click Merge in PR”) and not execute it without your explicit approval.  
- **First-time use of production DB** — if you ever allow automation to touch production (e.g. run migrations on main after merge), that should be a separate, gated step with explicit approval.  
- **Creating or rotating secrets** — you create Vercel token, Supabase keys, and store them; the agent never creates or rotates secrets.  
- **Destructive or broad operations** — e.g. “drop table”, “delete all users”; automation should not be able to run such commands without a clear, narrow allow-list (e.g. only run files under `supabase/migrations/`).

---

## 5. Smallest next step for biggest bottleneck reduction

**Recommendation: enable “retrieve preview URL” first.**

**Why it gives the biggest reduction for the smallest setup:**

- **Single manual action today:** You open Vercel Dashboard, find the deployment, copy the URL, then paste it somewhere or run checks yourself. That’s the repeated bottleneck for every preview.  
- **One-time setup:** Create a **Vercel API token** (read-only), store it in a secret the agent (or a script it runs) can read (e.g. Cursor env, or GitHub Secret), and add the **Vercel project ID** (from Vercel project settings).  
- **No DB or browser yet:** The agent still can’t apply migrations or run E2E, but it can:  
  - After you (or the agent) push the preview branch, **programmatically get the exact preview URL** and **deployment status**.  
  - Output that URL in the report so you have one place to look (or so a future script can use it).  
  - Optionally poll until deployment is READY and then report “Preview ready at &lt;url&gt;” so you don’t have to refresh the dashboard.  

**Concrete smallest next step:**

1. **You (one-time):**  
   - Vercel → Project Settings (or Account) → Tokens → Create token (read-only).  
   - Copy **project ID** from Vercel project settings (URL or General).  
   - Store in environment the agent can read:  
     - `VERCEL_TOKEN=<token>`  
     - `VERCEL_PROJECT_ID=<id>`  
     (e.g. in Cursor’s environment, or in a `.env.operator` that is gitignored and only used when running verification.)  
2. **Repo (one small addition, no deployment change):**  
   - A short script, e.g. `scripts/get-preview-url.ts` (or .js), that:  
     - Reads `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` and branch name (e.g. `preview/adaptive-skill-graph-memory-scheduler`),  
     - Calls Vercel API to list deployments for that branch,  
     - Returns the latest deployment’s `url` and `state` (or exits with message if not found).  
   - Agent can run this script after push and include the URL in the verification report.  

**What you gain immediately:** No more “go to Vercel and copy the URL”; the agent (or you running the script) gets the exact preview URL and status in one step. Migrations and browser verification can be added next, in that order, for further automation.

---

## Summary table

| Capability              | Automatable now? | One-time setup                          | Still needs approval   |
|-------------------------|------------------|-----------------------------------------|------------------------|
| Lint / typecheck / test | Yes              | —                                       | —                      |
| Apply migrations        | No               | Preview Supabase + secrets + script/job | Merge to main          |
| Get preview URL         | No               | Vercel token + project ID + script      | —                      |
| Browser verification    | No               | Playwright + verification script + auth | —                      |
| Merge to main           | No               | —                                       | Yes (always)            |

**Smallest next step:** Add Vercel token + project ID + `scripts/get-preview-url.ts` so the agent (or you) can retrieve the exact preview URL and deployment status with one run; no code or deployment changes beyond that script and env.
