# Phase 2 session flow — debug and verification

## Why sessions showed "Session complete" immediately

1. **Missing columns**  
   `learning_sessions` in production did not have `path`, `session_plan`, or `current_index` (migration 00008 may not have been applied). The plan and next APIs expect these columns. Without them, `session_plan` was NULL and `current_index` was missing, so `/api/v2/session/next` treated the plan as empty and returned 204 (session complete).

2. **Empty plan persisted**  
   When the planner had no exercises (e.g. no units/skills/lessons for the domain, or `loadSessionPlanData` returned empty), the plan API returned `exerciseIds: []` and either did not update the session or wrote a NULL/empty plan. The next route then saw `plan.length === 0` and returned 204 immediately.

3. **Exercises join**  
   The `exercises` table uses `lesson_id` (FK to `lessons`), not `skill_id`. Session data is loaded via: domain → skills → lessons → exercises (by `lesson_id`). Code that assumed `exercises.skill_id` would fail or return no rows.

## Verification SQL (run in Supabase SQL Editor)

Run after applying migration `00009_fix_phase2_schema.sql` (or equivalent):

```sql
-- 1) Check Phase 2 columns exist on learning_sessions
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'learning_sessions'
  AND column_name IN ('path', 'session_plan', 'current_index')
ORDER BY ordinal_position;
-- Expect: path (text), session_plan (jsonb, default '[]'::jsonb), current_index (integer, default 0)

-- 2) Check attempts.session_id exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'attempts'
  AND column_name = 'session_id';
-- Expect: one row

-- 3) Check skill_mastery.spaced_check_count exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'skill_mastery'
  AND column_name = 'spaced_check_count';
-- Expect: one row, default 0

-- 4) Check attempt_misconceptions table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'attempt_misconceptions'
);
-- Expect: true

-- 5) After starting a session and choosing a path, a row should have non-null session_plan
-- (Run after using the app: Start session → choose Level Up or Review & Shine)
SELECT id, path, session_plan, current_index,
       jsonb_array_length(COALESCE(session_plan, '[]'::jsonb)) AS plan_len
FROM public.learning_sessions
ORDER BY started_at DESC
LIMIT 3;
-- Expect: plan_len >= 1 for the latest session that had a plan generated (path non-null, session_plan non-null array).
```

## Applying the schema without `supabase db push`

If you are not using `supabase db push`, run the contents of `supabase/migrations/00009_fix_phase2_schema.sql` in the Supabase SQL Editor. See the commit message or the migration file for the exact SQL.
