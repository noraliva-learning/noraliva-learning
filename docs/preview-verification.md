# Preview verification (Action 2)

Run Playwright against a Vercel preview URL to verify the learner flow without manual clicking.

## Env vars

Load from `.env.local` automatically when running the command.

| Variable | Required | Description |
|----------|----------|-------------|
| **PREVIEW_URL** | Yes | Preview deployment URL (e.g. from `npm run preview:url -- <branch>`). |
| **TEST_LEARNER_EMAIL** | Yes | Test learner email (same as existing E2E). |
| **TEST_LEARNER_PASSWORD** | Yes | Test learner password. |
| **VERCEL_AUTOMATION_BYPASS_SECRET** | No (for protected previews) | Bypass secret from Vercel **Protection Bypass for Automation**. When set, requests send header `x-vercel-protection-bypass` so the test can access protected previews. |

## Vercel setting (for protected previews)

To run verification against a deployment that has **Deployment Protection** (e.g. Vercel Authentication) enabled:

1. In Vercel: open the **project** → **Settings** → **Deployment Protection**.
2. Enable **Protection Bypass for Automation** and create (or copy) a bypass secret.
3. Set that value locally as **VERCEL_AUTOMATION_BYPASS_SECRET** (e.g. in `.env.local`). Do not commit the secret.

Protection stays enabled for normal visitors; only requests that send the bypass header (or query param) skip the challenge.

## Command

**Unprotected preview:**

```bash
PREVIEW_URL=https://your-preview.vercel.app npm run verify:preview
```

**Protected preview (bypass enabled in Vercel + secret set):**

```bash
PREVIEW_URL=https://your-preview.vercel.app VERCEL_AUTOMATION_BYPASS_SECRET=your-secret npm run verify:preview
```

Or set `PREVIEW_URL` (and optionally `VERCEL_AUTOMATION_BYPASS_SECRET`) in `.env.local` and run:

```bash
npm run verify:preview
```

## What pass means

- Exit code **0**: All steps passed (login → dashboard → start session → question visible → submit answer → feedback or next-question state visible).
- Exit code **non-zero**: One or more steps failed or timed out; check the Playwright output and optional report in `playwright-report-preview/`.

## If you still see “Log in to Vercel”

If the test fails with a message that the preview is behind Vercel deployment protection:

- Set **VERCEL_AUTOMATION_BYPASS_SECRET** and enable **Protection Bypass for Automation** in Vercel (Settings → Deployment Protection), then rerun; or
- Use a preview URL that serves the app directly (e.g. protection disabled for that deployment).

## Reuse for future branches

Use the **same** command for any preview branch: set `PREVIEW_URL` to that branch’s deployment URL (e.g. run `npm run preview:url -- your-branch` and copy the URL). No code changes needed.
