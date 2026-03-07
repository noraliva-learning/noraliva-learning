-- Phase 2: Attempt-level misconceptions and session plan support.
-- attempt_misconceptions: tag wrong answers per attempt for struggle detection and micro-lessons.
-- learning_sessions: path choice and ordered exercise plan.
-- skill_mastery: spaced_check_count for promotion rule (2 spaced checks).

-- =============================================================================
-- ATTEMPT_MISCONCEPTIONS (per-attempt misconception tags)
-- =============================================================================
CREATE TABLE public.attempt_misconceptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id uuid NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  tag text NOT NULL,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attempt_misconceptions_attempt ON public.attempt_misconceptions(attempt_id);
CREATE INDEX idx_attempt_misconceptions_learner_skill_created
  ON public.attempt_misconceptions(learner_id, skill_id, created_at DESC);

COMMENT ON TABLE public.attempt_misconceptions IS 'Misconception tag per wrong attempt for struggle detection and targeted remediation.';

-- =============================================================================
-- LEARNING_SESSIONS: path and session plan
-- =============================================================================
ALTER TABLE public.learning_sessions
  ADD COLUMN IF NOT EXISTS path text CHECK (path IN ('level_up', 'review')),
  ADD COLUMN IF NOT EXISTS session_plan jsonb,
  ADD COLUMN IF NOT EXISTS current_index int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.learning_sessions.path IS 'Learner path choice: level_up (bias new/edge) or review (bias reinforcement).';
COMMENT ON COLUMN public.learning_sessions.session_plan IS 'Ordered array of exercise ids for this session.';
COMMENT ON COLUMN public.learning_sessions.current_index IS 'Index into session_plan for next exercise.';

-- =============================================================================
-- SKILL_MASTERY: spaced check count for promotion rule
-- =============================================================================
ALTER TABLE public.skill_mastery
  ADD COLUMN IF NOT EXISTS spaced_check_count int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.skill_mastery.spaced_check_count IS 'Number of spaced retention checks passed (correct at review interval); used for promotion rule.';

-- =============================================================================
-- ATTEMPTS: optional link to session (for fatigue / in-session stats)
-- =============================================================================
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.learning_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attempts_session ON public.attempts(session_id);

-- =============================================================================
-- RLS: attempt_misconceptions
-- =============================================================================
ALTER TABLE public.attempt_misconceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attempt_misconceptions_select" ON public.attempt_misconceptions
  FOR SELECT USING (public.can_access_learner(learner_id));

CREATE POLICY "attempt_misconceptions_insert" ON public.attempt_misconceptions
  FOR INSERT WITH CHECK (public.can_access_learner(learner_id));

CREATE POLICY "attempt_misconceptions_update" ON public.attempt_misconceptions
  FOR UPDATE USING (public.can_access_learner(learner_id));

CREATE POLICY "attempt_misconceptions_delete" ON public.attempt_misconceptions
  FOR DELETE USING (public.can_access_learner(learner_id));
