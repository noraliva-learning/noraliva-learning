# Vercel Preview Deployment Checklist

Use this checklist before pushing a **preview branch** (e.g. `preview/phase-7-reading`) for Vercel deployment.

---

## 1. Deployment gate (run locally or in CI)

### Build
```bash
npm run build
```
- **Note:** On Windows with OneDrive, `npm run build` may hit `EINVAL` (readlink) when clearing `.next`. Vercel runs on Linux and does not have this issue. If local build fails only with that error, the codebase is still deployable; run `npm run build` in GitHub Actions or trust Vercel’s build.

### Typecheck
```bash
npm run typecheck
```
- Must pass with no errors.

### Lint
```bash
npm run lint
```
- Fix any **errors**. Warnings may be acceptable depending on project rules.

### Key tests
```bash
npm run test -- --run src/lib/instruction/ src/lib/workmat/ src/lib/signals/insight-engine.test.ts src/lib/curriculum/reading-skill-map.test.ts
```
- Instruction/lesson generation, workmat, parent insight/signals, reading: all should pass.

---

## 2. Supabase migrations

Ensure all migrations are applied to the **Supabase project** used by the preview (e.g. same project as production or a preview DB).

Required for current teaching stack and Phase 7:

- All migrations in `supabase/migrations/` in order, including:
  - **00019_reading_skill_map.sql** (reading domain skills and prerequisites)

Apply via Supabase Dashboard (SQL Editor) or CLI:

```bash
supabase db push
```

Or run the contents of each migration file in order.

---

## 3. Environment variables

### Required for the app (Vercel Project → Settings → Environment Variables)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase service role key (server-only; RLS bypass for admin/bootstrap) |

### Optional

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | For AI-generated exercises and Ace help; if unset, fallbacks are used |
| `ACE_INSTRUCTION_ENGINE_OPENAI` | Set to `"true"` to use OpenAI for Ace lesson plans (math + reading); otherwise deterministic builder |
| `OPENAI_DAN_MODEL` | Model for Ace/instruction engine (e.g. `gpt-4o-mini`); default used if unset |
| `TEST_LEARNER_EMAIL` | E2E only; not needed for Vercel runtime |
| `TEST_LEARNER_PASSWORD` | E2E only; not needed for Vercel runtime |

Set env vars for **Preview** (and Production if desired) in Vercel.

---

## 4. Preview flows to confirm after deploy

After the preview deployment is live, verify (manually or via E2E):

1. **Learner login** — Sign in as a learner (e.g. Liv/Elle).
2. **Ace Lesson Math** — Start “Ace Lesson: Math”, get an episode, see focus → concept → … → celebration.
3. **Ace Lesson Reading** — Start “Ace Lesson: Reading”, get an episode, see reading skill and scenes.
4. **Visual teaching sequence** — When the plan includes it (e.g. visual modality), see “Step N of M” and step animations.
5. **Narration** — Voiceover/read-aloud plays where used; replay button works.
6. **Work Mat interaction** — On manipulative (or guided/independent with workmat), drawing/interaction works.
7. **Lesson completion** — Finish lesson → “Done” → redirect; completion is persisted.
8. **Mastery update** — After completion, skill mastery (and review schedule if applicable) updates.
9. **Parent insight page** — Parent can open insight view; switch **Domain: Math | Reading**; see mastery, latest lesson, next skill, insights.

---

## 5. Push preview branch (do not push to `main` until preview is verified)

From repo root, with a clean working tree and migrations applied:

```bash
# Create preview branch
git checkout -b preview/phase-7-reading

# Stage only intended files (no .env, .next, or unrelated changes)
git add .

# Commit
git commit -m "feat: Phase 7 reading domain, deployment gate fixes, preview docs"

# Push (triggers Vercel preview deployment)
git push origin preview/phase-7-reading
```

- Open the **Vercel dashboard** → Deployments → select the deployment for `preview/phase-7-reading` and copy the **Preview URL**.
- Run through the flows above on that URL.
- Only after confirmation, merge to `main` (or your production branch) if desired.

---

## 6. Blockers that must be fixed before deploy

- **Typecheck** must pass (no `tsc` errors).
- **Lint** must have no **errors** (Next.js build runs lint and can fail on errors).
- **Migrations** — `00019_reading_skill_map.sql` (and any earlier ones) must be applied to the Supabase project used by the preview.
- **Env** — At least `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel for the preview environment.

Local-only issues that do **not** block Vercel deploy:

- `EINVAL`/readlink when running `npm run build` on Windows/OneDrive (Vercel builds on Linux).
- E2E tests that require `TEST_LEARNER_EMAIL`/`TEST_LEARNER_PASSWORD` (optional for deploy; run in CI or locally with credentials).

---

## 7. Summary

| Step | Command / action |
|------|-------------------|
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Tests | `npm run test -- --run src/lib/instruction/ src/lib/workmat/ src/lib/signals/insight-engine.test.ts src/lib/curriculum/reading-skill-map.test.ts` |
| Build | `npm run build` (if it fails only with readlink/EINVAL on Windows, still safe to push for Vercel) |
| Migrations | Apply `00019_reading_skill_map.sql` (and all prior) to Supabase |
| Env | Set required Supabase vars (and optional OpenAI/Ace vars) in Vercel → Preview |
| Push | `git checkout -b preview/<name>` → commit → `git push origin preview/<name>` |
