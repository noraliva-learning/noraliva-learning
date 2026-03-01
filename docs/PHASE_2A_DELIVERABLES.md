# Phase 2A — Supabase Auth + RLS + DB Schema (V2) — Deliverables

## 1. File tree (Phase 2A additions)

```
noraliva-learning/
├── .env.example                          # Supabase URL + anon key template
├── src/
│   ├── middleware.ts                     # Protects /v2/*, redirects to /v2/login when unauthenticated
│   ├── app/
│   │   └── v2/
│   │       ├── layout.tsx                # V2 layout wrapper
│   │       ├── login/
│   │       │   └── page.tsx              # Sign-in (no public signup)
│   │       ├── parent/
│   │       │   └── page.tsx              # Parent dashboard placeholder
│   │       └── learn/
│   │           └── page.tsx              # Learn session placeholder
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts                 # Browser Supabase client
│       │   ├── server.ts                 # Server Supabase client (cookies)
│       │   ├── middleware.ts             # Session refresh helper (optional use)
│       │   └── types.ts                  # DB types (Profile, Domain, etc.)
│       └── db/
│           ├── index.ts                  # Re-exports
│           ├── xp-streak.ts              # getXpStreak, upsertXpStreak (replace localStorage)
│           └── useXpStreak.ts            # React hook for XP/streak in V2
├── supabase/
│   └── migrations/
│       ├── 00001_schema.sql              # profiles, learners view, domains, skills, lessons, exercises,
│       │                                  # attempts, skill_mastery, misconceptions, review_schedule,
│       │                                  # xp_streaks, generated_content_metadata, chat_logs
│       └── 00002_rls.sql                 # RLS: child own data, parent all
└── docs/
    └── PHASE_2A_DELIVERABLES.md          # This file
```

**Existing production routes (unchanged):** `/`, `/learners/[learnerId]`, `/learners/[learnerId]/domains`, `/learners/[learnerId]/domains/[domainId]`, `/learners/.../mission` — all remain as-is.

---

## 2. Migrations / SQL

- **`supabase/migrations/00001_schema.sql`**  
  - Tables: `profiles` (id = auth.uid(), role parent | liv | elle), `learners` (view), `domains`, `skills`, `lessons`, `exercises`, `attempts`, `skill_mastery`, `misconceptions`, `review_schedule`, `xp_streaks`, `generated_content_metadata`, `chat_logs`.  
  - Seed: `domains` (math, reading, writing, architecture, spanish).

- **`supabase/migrations/00002_rls.sql`**  
  - RLS enabled on all above (except view).  
  - Helpers: `current_user_profile()`, `current_user_role()`, `is_parent_of(uuid)`, `can_access_learner(uuid)`.  
  - Policies:  
    - **Child (liv/elle):** read/write own profile; read/write only own rows in attempts, skill_mastery, misconceptions, review_schedule, xp_streaks, chat_logs.  
    - **Parent:** read/write own profile; read/write children’s profiles and all of their attempts, mastery, chat, etc.  
    - **Catalog:** domains, skills, lessons, exercises — SELECT for authenticated.

**How to run:** In Supabase Dashboard → SQL Editor, run `00001_schema.sql` then `00002_rls.sql`, or use `supabase db push` if using Supabase CLI.

---

## 3. Verification checklist

### 3.1 Environment

- [ ] Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. (Build succeeds without env; runtime requires it for V2 auth.)
- [ ] Supabase project created; migrations applied (no errors).

### 3.2 Auth (no public signup)

- [ ] Sign up disabled in Supabase Dashboard (Authentication → Providers → Email: “Confirm email” as needed; do not enable public signup if using invite-only).
- [ ] Create at least one **parent** and one **learner** (liv or elle) via Dashboard (Authentication → Users → Add user) or via Admin API. After creating each user, insert a row into `public.profiles` with the same `id` (user id), `role` ('parent' or 'liv'/'elle'), `display_name`, and for learners set `parent_id` to the parent’s user id.

### 3.3 App

- [ ] `npm run build` succeeds.
- [ ] Unauthenticated visit to `/v2/parent` or `/v2/learn` redirects to `/v2/login`.
- [ ] Sign in with parent credentials → redirect to `/v2/parent`; dashboard placeholder loads.
- [ ] From dashboard, “Go to Learn session” → `/v2/learn` loads.
- [ ] Sign out → redirect to `/v2/login`.
- [ ] Original routes (e.g. `/`, `/learners/liv/domains`) still work (no regression).

### 3.4 DB persistence (V2)

- [ ] When using V2 learn flow with an authenticated learner, XP/streak can be read and written via `useXpStreak(learnerId, domainSlug)` or `getXpStreakBySlug` / `upsertXpStreak`; data appears in `xp_streaks` table.

### 3.5 RLS

- [ ] RLS tests (below) pass.

---

## 4. RLS test procedure

Run these in Supabase SQL Editor or via a script that uses the Supabase client with different auth contexts.

### 4.1 Setup

1. Create two users in Auth (or use existing):  
   - **Parent:** e.g. `parent@test.com`  
   - **Learner (child):** e.g. `liv@test.com`
2. In `public.profiles`:  
   - Insert parent: `id = <parent auth id>, role = 'parent', display_name = 'Parent'`.  
   - Insert learner: `id = <learner auth id>, role = 'liv', display_name = 'Liv', parent_id = <parent auth id>`.
3. Get the UUIDs: `parent_id`, `learner_id`.

### 4.2 Tests (as learner)

Use the **learner’s** JWT (e.g. sign in as learner in the app and copy the session, or use Supabase Auth API to get a token). Then, with the Supabase client set to use the learner’s session:

1. **Learner can read own profile**  
   `select * from profiles where id = '<learner_id>';`  
   → Returns one row.

2. **Learner cannot read parent’s profile** (except via parent_id relationship; our policies allow reading children, not “other adults”).  
   So: learner reading `where id = '<parent_id>'` → should return no row (parent is not the learner, and learner is not the parent of parent).

3. **Learner can read own xp_streaks**  
   Insert one row (as service role or in SQL with RLS bypass) for `learner_id = <learner_id>`, then as learner:  
   `select * from xp_streaks where learner_id = '<learner_id>';`  
   → Returns that row.

4. **Learner cannot read another learner’s xp_streaks**  
   Create another learner (e.g. elle) and an xp_streaks row for them. As liv:  
   `select * from xp_streaks where learner_id = '<elle_id>';`  
   → Returns no rows.

5. **Learner can insert/update own xp_streaks**  
   As learner, insert or upsert a row with `learner_id = '<learner_id>'` → success.

6. **Learner can read own chat_logs**  
   As learner, `select * from chat_logs where learner_id = '<learner_id>';` → only own rows.

### 4.3 Tests (as parent)

Use the **parent’s** JWT:

1. **Parent can read own profile**  
   `select * from profiles where id = '<parent_id>';` → one row.

2. **Parent can read child’s profile**  
   `select * from profiles where parent_id = '<parent_id>';` → child row(s).

3. **Parent can read child’s xp_streaks**  
   `select * from xp_streaks where learner_id = '<learner_id>';` → child’s rows (because `can_access_learner(learner_id)` is true when parent_id = parent).

4. **Parent can update child’s xp_streaks**  
   As parent, update a row in `xp_streaks` for `learner_id = '<learner_id>'` → success.

5. **Parent can read child’s chat_logs**  
   `select * from chat_logs where learner_id = '<learner_id>';` → child’s rows.

### 4.4 Catalog (any authenticated user)

- As either parent or learner:  
  `select * from domains;`  
  `select * from skills;`  
  → Returns rows (read-only by policy).

### 4.5 Summary

| Actor  | Own profile | Child profile | Own attempts/mastery/chat/xp_streaks | Other learner’s data | Catalog (domains/skills/…) |
|--------|-------------|---------------|--------------------------------------|------------------------|----------------------------|
| Child  | R/W         | —             | R/W                                  | No                     | R                          |
| Parent | R/W         | R/W           | R/W (for their children)             | No                     | R                          |

---

## 5. Replacing localStorage with DB (V2)

- **Provided:** `src/lib/db/xp-streak.ts` and `useXpStreak` in `src/lib/db/useXpStreak.ts`.
- **Usage in V2:** In the V2 learn session (or when you migrate the domain page to V2), use `useXpStreak(learnerId, domainSlug)` where `learnerId` is the authenticated learner’s UUID. Call `save(state)` whenever XP, streak, challenge day, or last completed date change.
- **Existing prototype:** Routes under `/learners/[learnerId]/domains/[domainId]` still use localStorage; no change required for Phase 2A. When you switch that page to V2 (auth + learner UUID), replace `loadState`/`saveState` with `useXpStreak` or the async get/upsert helpers.

---

## 6. Wiring Vercel to V2 later

- V2 routes live under `/v2/*`. Production routes remain at `/`, `/learners/*`, etc.
- To make V2 the default: either (a) redirect root to `/v2/login` in middleware and serve the app from `/v2`, or (b) move the existing app into a path (e.g. `/legacy`) and serve the new app at `/`. No schema or RLS changes required for that step.
