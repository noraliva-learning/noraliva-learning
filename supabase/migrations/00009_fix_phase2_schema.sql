-- Phase 2 schema fix: ensure learning_sessions has path, session_plan, current_index;
-- attempts has session_id; skill_mastery has spaced_check_count; attempt_misconceptions exists.
-- Safe to run even if some columns/tables already exist (e.g. 00008 partially applied).
-- Additive only; no drops.

-- =============================================================================
-- LEARNING_SESSIONS: path, session_plan, current_index
-- =============================================================================
ALTER TABLE public.learning_sessions
  ADD COLUMN IF NOT EXISTS path text,
  ADD COLUMN IF NOT EXISTS session_plan jsonb,
  ADD COLUMN IF NOT EXISTS current_index int NOT NULL DEFAULT 0;

-- Ensure session_plan has default and no NULLs (so "Session complete" doesn't show immediately)
ALTER TABLE public.learning_sessions
  ALTER COLUMN session_plan SET DEFAULT '[]'::jsonb;

UPDATE public.learning_sessions
SET session_plan = COALESCE(session_plan, '[]'::jsonb)
WHERE session_plan IS NULL;

-- Constrain path to valid values (idempotent)
ALTER TABLE public.learning_sessions DROP CONSTRAINT IF EXISTS learning_sessions_path_check;
ALTER TABLE public.learning_sessions
  ADD CONSTRAINT learning_sessions_path_check CHECK (path IS NULL OR path IN ('level_up', 'review'));

COMMENT ON COLUMN public.learning_sessions.path IS 'Learner path choice: level_up (bias new/edge) or review (bias reinforcement).';
COMMENT ON COLUMN public.learning_sessions.session_plan IS 'Ordered array of exercise ids for this session. Default [] so next/attempt routes see valid plan.';
COMMENT ON COLUMN public.learning_sessions.current_index IS 'Index into session_plan for next exercise.';

-- =============================================================================
-- ATTEMPTS: session_id (FK to learning_sessions)
-- =============================================================================
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.learning_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attempts_session ON public.attempts(session_id);

-- =============================================================================
-- SKILL_MASTERY: spaced_check_count for promotion rule
-- =============================================================================
ALTER TABLE public.skill_mastery
  ADD COLUMN IF NOT EXISTS spaced_check_count int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.skill_mastery.spaced_check_count IS 'Number of spaced retention checks passed; used for promotion rule.';

-- =============================================================================
-- ATTEMPT_MISCONCEPTIONS (if 00008 did not run)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.attempt_misconceptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id uuid NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  tag text NOT NULL,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempt_misconceptions_attempt ON public.attempt_misconceptions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_misconceptions_learner_skill_created
  ON public.attempt_misconceptions(learner_id, skill_id, created_at DESC);

COMMENT ON TABLE public.attempt_misconceptions IS 'Misconception tag per wrong attempt for struggle detection and targeted remediation.';

-- RLS: attempt_misconceptions (consistent with can_access_learner)
ALTER TABLE public.attempt_misconceptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attempt_misconceptions' AND policyname = 'attempt_misconceptions_select') THEN
    CREATE POLICY "attempt_misconceptions_select" ON public.attempt_misconceptions
      FOR SELECT USING (public.can_access_learner(learner_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attempt_misconceptions' AND policyname = 'attempt_misconceptions_insert') THEN
    CREATE POLICY "attempt_misconceptions_insert" ON public.attempt_misconceptions
      FOR INSERT WITH CHECK (public.can_access_learner(learner_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attempt_misconceptions' AND policyname = 'attempt_misconceptions_update') THEN
    CREATE POLICY "attempt_misconceptions_update" ON public.attempt_misconceptions
      FOR UPDATE USING (public.can_access_learner(learner_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attempt_misconceptions' AND policyname = 'attempt_misconceptions_delete') THEN
    CREATE POLICY "attempt_misconceptions_delete" ON public.attempt_misconceptions
      FOR DELETE USING (public.can_access_learner(learner_id));
  END IF;
END $$;
