# How to Test the Vertical Slice

This checklist verifies the end-to-end learning loop: **Login → Start Mission → Submit 1 answer → DB write → mastery update → parent can see it.**

## Prerequisites

- `.env.local` with valid Supabase URL and anon key (no secrets in client code).
- Migrations applied (`supabase db push` or run migrations in Supabase SQL Editor):
  - `00001_schema.sql`
  - `00002_rls.sql`
  - `00003_learning_sessions.sql`
  - `00004_seed_math_exercise.sql`
  - `00005_golden_curriculum_units.sql`
  - `00006_seed_golden_curriculum.sql`
- Test users exist: one **parent**, one **learner (Liv)** and optionally one **learner (Elle)**, with `parent_id` set on learners to the parent’s profile id.

## Curriculum flow

- **Golden Curriculum** is domain → unit → skill → lesson → exercise. Each domain has at least one unit with one skill, one lesson, and one exercise (seeded in `00006`).
- **Next exercise** is chosen deterministically: first exercise in curriculum order that the learner has not yet answered correctly; if all are correct, the first exercise is shown again (review).
- The learner can start a session in **any** of the five domains (Math, Reading, Writing, Architecture, Spanish) and receive at least one seeded exercise.

## Steps

1. **Sign in as learner (Liv)**  
   Go to `/v2/login`, sign in with Liv’s credentials.

2. **Start a mission in any domain**  
   You should be on the Learner Dashboard (`/v2/learners/liv`). Click **Math**, **Reading**, **Writing**, **Architecture**, or **Spanish** (or “Start a session” for that domain). You should be redirected to a session page (`/v2/learn/session/<sessionId>`).

3. **Answer the question**  
   You should see a question for that domain (e.g. Math: “What is 2 + 2?”; Reading: “Which word is ‘the’?”).  
   - For Math: **4** is correct, **5** is incorrect.  
   - Click the correct option → “Correct!” and “Mastery level for this skill: 1”.  
   - Click an incorrect option → “Not quite.” and mastery stays 0.

4. **End session (optional)**  
   Click **End Session** to return to the learner dashboard.

5. **Sign in as parent**  
   Sign out, then sign in with the parent account. Go to Parent Dashboard (`/v2/parent`).

6. **Verify parent view**  
   Under “Learner progress” you should see Liv (and Elle if configured) with:  
   - **Attempts:** one row for the exercise — Correct/Incorrect and timestamp.  
   - **Skill mastery:** the skill name and level (e.g. “Basic addition: level 1” if you answered correctly in Math).

## Expected result

- One row in `attempts` for the learner and exercise.
- One row (or updated row) in `skill_mastery` for the learner and the skill.
- Parent dashboard shows that attempt and mastery without needing to refresh (or after a refresh).

## Edge cases (optional)

- Sign out mid-session → should redirect to `/v2/login`.
- Submit then try to submit again → UI shows result once; no duplicate submits needed.
- Sign in as Elle, do the same flow → parent sees both Liv and Elle’s progress when viewing as parent.
- Start a session in Reading, Writing, Architecture, or Spanish → you get the single seeded exercise for that domain.

---

*Part of the 3 Anchors implementation (Definition of Done, CI, Vertical Slice).*
