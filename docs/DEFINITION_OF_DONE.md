# Definition of Done

Use this checklist before marking any feature or change as **done**. It keeps the repo safe for AI-native development and production.

## Before coding

- [ ] **Spec approval** — Requirements or spec (even brief) are agreed or documented before implementation.
- [ ] **Scope** — Change is scoped to avoid breaking existing production routes and behavior.

## Data & security

- [ ] **DB migration review** — Any new or changed tables/columns have a migration reviewed for correctness and RLS.
- [ ] **RLS verification** — When auth or sensitive data is touched, RLS policies are verified (or explicitly documented as N/A).
- [ ] **No secrets** — No API keys, passwords, or tokens committed; none exposed in client-side code.

## Quality & testing

- [ ] **Unit tests** — New or touched logic has unit tests; `npm run test` passes.
- [ ] **E2E tests** — Critical user flows have E2E coverage where practical; `npm run test:e2e` passes.
- [ ] **CI must pass** — Lint, typecheck (if present), unit tests, and E2E run in CI and are green.

## Observability & rollout

- [ ] **Telemetry/logging** — Meaningful logs or telemetry exist for failures and key actions (no PII in logs).
- [ ] **Feature flags or safe rollout** — Risky changes are behind a flag or rolled out in a safe, reversible way.

## Release readiness

- [ ] **Rollback plan** — Known how to revert (e.g. revert commit, disable feature flag, redeploy previous version).
- [ ] **Manual acceptance** — Someone has run through the “How to Test” steps and verified behavior.

---

## How to Test (per feature)

For each feature, maintain a short **How to Test** checklist so anyone (or AI) can verify it:

1. **Prerequisites** — e.g. env vars, test users (liv/elle/parent), DB migrations applied.
2. **Steps** — Numbered steps to reproduce the happy path.
3. **Expected result** — What the user should see or what should be stored (e.g. new attempt row, mastery updated).
4. **Edge cases** — Optional: what to try for auth failure, invalid input, etc.

Example:

- **Prerequisites:** `.env.local` with Supabase URL/anon key; migrations applied; test users exist.
- **Steps:** 1) Sign in as Liv. 2) Start Math mission. 3) Answer the single question and submit. 4) Sign in as parent, open Parent Dashboard.
- **Expected:** Attempt row for Liv; skill_mastery updated; parent view shows Liv’s attempt and mastery.
- **Edge cases:** Sign out mid-session; submit without answering.

---

*Last updated: for 3 Anchors implementation (Definition of Done, CI, Vertical Slice).*
