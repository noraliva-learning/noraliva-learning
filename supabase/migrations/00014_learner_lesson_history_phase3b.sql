-- Phase 3B: Closed-loop mastery — audit trail for lesson decisions.
-- One row per completed lesson: decision, mastery before/after, next skill chosen.

CREATE TABLE public.learner_lesson_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.lesson_episodes(id) ON DELETE CASCADE,
  domain text NOT NULL,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  promotion_decision text NOT NULL CHECK (promotion_decision IN ('advance', 'hold', 'review', 'reteach')),
  mastery_before double precision,
  mastery_after double precision,
  confidence_before double precision,
  confidence_after double precision,
  next_skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  next_skill_reason text,
  next_skill_why text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.learner_lesson_history IS 'Phase 3B: Audit trail of lesson completion and promotion/hold/review decisions.';

CREATE INDEX idx_learner_lesson_history_learner ON public.learner_lesson_history(learner_id);
CREATE INDEX idx_learner_lesson_history_created ON public.learner_lesson_history(created_at DESC);

ALTER TABLE public.learner_lesson_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_lesson_history_select" ON public.learner_lesson_history
  FOR SELECT USING (public.can_access_learner(learner_id));

CREATE POLICY "learner_lesson_history_insert" ON public.learner_lesson_history
  FOR INSERT WITH CHECK (learner_id = auth.uid());
