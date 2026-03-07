# Noraliva Database Schema Map

**Source:** All files in `supabase/migrations` (00001–00010).  
**Purpose:** Reference for AI operators and developers: tables, relationships, RLS, and critical write paths.

---

## 1. Tables Overview

| Table | Key columns | Purpose |
|-------|-------------|---------|
| **profiles** | id (PK, FK auth.users), role, display_name, parent_id, age, grade_label, challenge_style | Auth users: parent and learners (liv/elle). No public signup; parent creates child accounts. |
| **learners** (view) | Same as profiles subset | Convenience view: `role IN ('liv', 'elle')`. |
| **domains** | id, slug, name | Curriculum domains (math, reading, writing, architecture, spanish). |
| **units** | id, domain_id, slug, name, sort_order | Curriculum units within a domain (e.g. Foundations). |
| **skills** | id, domain_id, unit_id, slug, name, sort_order | Skills within a unit. |
| **lessons** | id, skill_id, title, sort_order | Lessons within a skill. |
| **exercises** | id, lesson_id, prompt, sort_order, correct_answer, answer_type | Exercises (prompts). correct_answer/answer_type added for AI-generated exercises (00010). |
| **attempts** | id, learner_id, exercise_id, correct, session_id, created_at | One row per answer submission. session_id links to learning_sessions (00008). |
| **skill_mastery** | id, learner_id, skill_id, level, mastery_probability, confidence_score, attempts_count, last_attempt_at, next_review_at, spaced_check_count, updated_at | Per-learner per-skill mastery (Bayesian + spaced repetition). |
| **misconceptions** | id, learner_id, skill_id, note, created_at | Learner-level misconception notes (free-form). |
| **attempt_misconceptions** | id, attempt_id, learner_id, skill_id, tag, exercise_id, metadata, created_at | Per-attempt misconception tag for wrong answers (struggle detection, micro-lessons). |
| **review_schedule** | id, learner_id, skill_id, next_review_at, created_at, updated_at | When to next review each skill (spaced repetition). UNIQUE(learner_id, skill_id). |
| **learning_sessions** | id, learner_id, domain, status, started_at, ended_at, path, session_plan, current_index | One row per active/completed session; path = level_up | review; session_plan = ordered exercise ids. |
| **xp_streaks** | id, learner_id, domain_id, xp, streak, challenge_day, last_completed_date, committed, updated_at | XP and streak per learner per domain. UNIQUE(learner_id, domain_id). |
| **generated_content_metadata** | id, content_type, external_id, metadata (jsonb), created_at | Metadata for AI-generated content (parent viewable). |
| **chat_logs** | id, learner_id, role (user|assistant), content, created_at | Chat history (parent viewable). |

---

## 2. Relationships (Simplified)

- **profiles**: id ← parent_id (self-ref); id ← auth.users(id).
- **domains** → **units** (domain_id); **units** → **skills** (unit_id); **skills** → **lessons** (skill_id); **lessons** → **exercises** (lesson_id).
- **profiles** ← **attempts** (learner_id), **skill_mastery** (learner_id), **misconceptions** (learner_id), **attempt_misconceptions** (learner_id), **review_schedule** (learner_id), **learning_sessions** (learner_id), **xp_streaks** (learner_id), **chat_logs** (learner_id).
- **attempts** ← **attempt_misconceptions** (attempt_id).
- **learning_sessions** ← **attempts** (session_id, optional).

---

## 3. Table Categories

- **Learner-facing (primary user = learner):** profiles (own), attempts, skill_mastery, attempt_misconceptions, review_schedule, learning_sessions, xp_streaks, chat_logs.
- **Parent-facing (read for dashboard/reports):** profiles (own + children), attempts, skill_mastery, misconceptions, attempt_misconceptions, review_schedule, xp_streaks, chat_logs, generated_content_metadata.  
  **Note:** `learning_sessions` RLS in migrations only allows `learner_id = auth.uid()` (no parent policy); parent may not see children’s sessions unless added elsewhere.
- **AI-generation-related:** exercises (inserts from generate-exercise API: correct_answer, answer_type); lessons (insert via getOrCreateLessonForSkill); generated_content_metadata (read for authenticated; no app writes found in repo).
- **Review-scheduling-related:** review_schedule (next_review_at per learner/skill); skill_mastery (next_review_at, spaced_check_count). Both written on answer submission.

---

## 4. RLS and Policies

**Defined in:** `00002_rls.sql`, `00003_learning_sessions.sql`, `00005_golden_curriculum_units.sql`, `00008_attempt_misconceptions_and_session_plan.sql`, `00009_fix_phase2_schema.sql`, `00010_ai_exercises.sql`.

**Helper functions (SECURITY DEFINER):**

- `current_user_profile()` – current user’s profile row.
- `current_user_role()` – current user’s role.
- `is_parent_of(learner_uuid)` – true if current user is the learner’s parent.
- `can_access_learner(learner_uuid)` – true if current user is the learner or parent of the learner.

**RLS enabled on:** profiles, domains, skills, lessons, exercises, attempts, skill_mastery, misconceptions, review_schedule, xp_streaks, generated_content_metadata, chat_logs, learning_sessions, units, attempt_misconceptions.

**Policy summary:**

| Table | Select | Insert | Update | Delete |
|-------|--------|--------|--------|--------|
| profiles | Own; children (parent_id = auth.uid()) | Own (id = auth.uid()) | Own; children | — |
| domains, skills, lessons, exercises | Authenticated | lessons/exercises: authenticated (00010) | — | — |
| units | Authenticated | — | — | — |
| attempts | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) |
| skill_mastery | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) |
| misconceptions | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) |
| attempt_misconceptions | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) |
| review_schedule | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) |
| xp_streaks | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) |
| learning_sessions | learner_id = auth.uid() | learner_id = auth.uid() | learner_id = auth.uid() | — |
| generated_content_metadata | authenticated | (none; service role / app) | — | — |
| chat_logs | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) | can_access_learner(learner_id) |

**Protection summary:** Learner and parent can only read/write data for the learner or the parent’s children. Curriculum (domains, units, skills, lessons, exercises) is read-only for authenticated users except lessons/exercises insert for AI generation. Learning sessions are learner-only (no parent policy in migrations). Generated content is read-only for authenticated; writes are expected via service role or app logic.

---

## 5. Critical Write Paths

Which tables are written to during each flow (from migrations + app code in `src`).

### 5.1 Learner login

- **profiles:** No automatic write in migrations (no trigger on auth.users). RLS allows insert for own id; app may create/update profile on first login (not found in scanned code). Child profiles are documented as created via “service role or a trigger” but no trigger exists in migrations.
- **Other tables:** No direct writes on login.

### 5.2 Session start

- **learning_sessions:** INSERT one row (learner_id, domain, status = 'active', session_plan = [], current_index = 0).  
  **Code:** `src/app/api/v2/session/start/route.ts`.

### 5.3 Answer submission

- **attempts:** INSERT one row (learner_id, exercise_id, correct, session_id).  
  **Code:** `submitAttemptForSession` in `src/lib/db/submitAttemptForSession.ts`.
- **attempt_misconceptions:** INSERT when answer is wrong (attempt_id, learner_id, skill_id, tag, exercise_id, metadata). Tag from classifier or optional API param.  
  **Code:** same; calls `insertAttemptMisconception` from `src/lib/db/misconceptions.ts`.
- **skill_mastery:** UPSERT (learner_id, skill_id, level, mastery_probability, confidence_score, attempts_count, last_attempt_at, next_review_at, spaced_check_count, updated_at).  
  **Code:** same `submitAttemptForSession`.
- **review_schedule:** UPSERT (learner_id, skill_id, next_review_at, updated_at).  
  **Code:** same `submitAttemptForSession`.
- **learning_sessions:** UPDATE current_index += 1 after successful attempt (planned session only, not AI-only mode).  
  **Code:** `src/app/api/v2/session/attempt/route.ts`.

### 5.4 Mastery update

- **skill_mastery:** Same UPSERT as in answer submission. Mastery is updated only as part of `submitAttemptForSession` (no separate “mastery update” endpoint).  
  **Code:** `src/lib/db/submitAttemptForSession.ts` (and legacy `src/lib/db/submitAnswer.ts` if still used).

### 5.5 Misconception tagging

- **attempt_misconceptions:** INSERT one row per wrong attempt (see 5.3). Tag from `classifyMisconception()` or optional `misconceptionTag` from API.  
  **Code:** `submitAttemptForSession` → `insertAttemptMisconception` in `src/lib/db/misconceptions.ts`.  
- **misconceptions** (learner-level notes table): No app writes found in repo; schema exists for parent/operator notes.

### 5.6 Review scheduling

- **review_schedule:** UPSERT (learner_id, skill_id, next_review_at, updated_at) on each answer submission; next_review_at from `scheduleNextReview()` in mastery engine.  
  **Code:** `src/lib/db/submitAttemptForSession.ts`.
- **skill_mastery:** next_review_at and spaced_check_count updated in same flow (see 5.3 / 5.4).

---

## 6. Unknown / Needs Verification

- **Profile creation on login:** No DB trigger in migrations for creating a profile when a user signs up. RLS allows insert where id = auth.uid(). Whether the app or a separate trigger creates parent/child profiles is not confirmed in the scanned code.
- **Parent access to learning_sessions:** RLS only allows learner_id = auth.uid(). If parents should see children’s sessions, a policy (e.g. using can_access_learner(learner_id)) may be missing.
- **Table `misconceptions` (learner-level notes):** Present in schema and RLS; no inserts/updates found in app code. May be used by admin/parent UI or future feature.
- **generated_content_metadata:** Read policy for authenticated; no app code found writing to it. May be used by another service or future AI metadata flow.
- **chat_logs:** RLS allows learner/parent read/write; no app code found writing chat messages in the scanned repo.
- **xp_streaks:** Table and RLS exist; `src/lib/db/xp-streak.ts` performs upsert. Whether this is invoked from session/answer flow or a separate “commit day” flow is not fully traced here.
- **Duplicate migration paths:** Both `supabase/migrations/` and `supabase\migrations\` appear in file lists (e.g. 00009); confirm only one set is applied to avoid duplicate policy/object creation.

---

## 7. Migration File Reference

| File | Contents |
|------|----------|
| 00001_schema.sql | profiles, learners view, domains, skills, lessons, exercises, attempts, skill_mastery, misconceptions, review_schedule, xp_streaks, generated_content_metadata, chat_logs; triggers set_updated_at; seed domains. |
| 00002_rls.sql | RLS helpers; enable RLS and policies for all 00001 tables (+ learning_sessions if present). |
| 00003_learning_sessions.sql | learning_sessions table; RLS (learner only). |
| 00004_seed_math_exercise.sql | Seed one math skill, lesson, exercise. |
| 00005_golden_curriculum_units.sql | units table; skills.unit_id, sort_order; lessons/exercises sort_order; units RLS. |
| 00006_seed_golden_curriculum.sql | Seed units and skills/lessons/exercises per domain. |
| 00007_skill_mastery_mastery_engine.sql | skill_mastery: mastery_probability, confidence_score, attempts_count, last_attempt_at, next_review_at; indexes. |
| 00008_attempt_misconceptions_and_session_plan.sql | attempt_misconceptions table; learning_sessions path, session_plan, current_index; skill_mastery spaced_check_count; attempts session_id; RLS for attempt_misconceptions. |
| 00009_fix_phase2_schema.sql | Idempotent adds/defaults for path, session_plan, current_index, session_id, spaced_check_count; CREATE TABLE IF NOT EXISTS attempt_misconceptions; RLS with IF NOT EXISTS. |
| 00010_ai_exercises.sql | exercises correct_answer, answer_type; policies lessons_insert_authenticated, exercises_insert_authenticated. |
