# How to Test the Vertical Slice

This checklist verifies the end-to-end learning loop: **Login → Start Mission → Submit 1 answer → DB write → mastery update → parent can see it.**

## Prerequisites

- `.env.local` with valid Supabase URL and anon key (no secrets in client code).
- Migrations applied (`supabase db push` or run migrations in Supabase SQL Editor):
  - `00001_schema.sql`
  - `00002_rls.sql`
  - `00003_learning_sessions.sql`
  - `00004_seed_math_exercise.sql`
- Test users exist: one **parent**, one **learner (Liv)** and optionally one **learner (Elle)**, with `parent_id` set on learners to the parent’s profile id.

## Steps

1. **Sign in as learner (Liv)**  
   Go to `/v2/login`, sign in with Liv’s credentials.

2. **Start a Math mission**  
   You should be on the Learner Dashboard (`/v2/learners/liv`). Click **Math** (or “Start a session” for Math). You should be redirected to a session page (`/v2/learn/session/<sessionId>`).

3. **Answer the single question**  
   You should see: “What is 2 + 2?” with two options: **4** (correct) and **5** (incorrect).  
   - Click **4** → “Correct!” and “Mastery level for this skill: 1”.  
   - (Alternatively, click **5** → “Not quite.” and mastery stays 0.)

4. **End session (optional)**  
   Click **End Session** to return to the learner dashboard.

5. **Sign in as parent**  
   Sign out, then sign in with the parent account. Go to Parent Dashboard (`/v2/parent`).

6. **Verify parent view**  
   Under “Learner progress” you should see Liv (and Elle if configured) with:  
   - **Attempts:** one row for “What is 2 + 2?” — Correct/Incorrect and timestamp.  
   - **Skill mastery:** “Basic addition: level 1” (if you answered correctly).

## Expected result

- One row in `attempts` for the learner and exercise.
- One row (or updated row) in `skill_mastery` for the learner and “Basic addition” skill.
- Parent dashboard shows that attempt and mastery without needing to refresh (or after a refresh).

## Edge cases (optional)

- Sign out mid-session → should redirect to `/v2/login`.
- Submit then try to submit again → UI shows result once; no duplicate submits needed.
- Sign in as Elle, do the same flow → parent sees both Liv and Elle’s progress when viewing as parent.

---

*Part of the 3 Anchors implementation (Definition of Done, CI, Vertical Slice).*
