-- Phase 5: Learning signal layer — one row per completed lesson with signals.
CREATE TABLE public.lesson_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.lesson_episodes(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain text NOT NULL,
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  signals_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lesson_signals IS 'Phase 5: Learning signals per lesson (latency, hints, workmat, replay, etc.).';
COMMENT ON COLUMN public.lesson_signals.signals_json IS 'Structured signals: response_latency_ms, hint_requests, answer_changed_before_submit, guided_success, independent_success, workmat_used, narration_replay_count, scene_replay_count, scene_outcomes, etc.';

CREATE UNIQUE INDEX idx_lesson_signals_episode ON public.lesson_signals(episode_id);
CREATE INDEX idx_lesson_signals_learner_domain ON public.lesson_signals(learner_id, domain);
CREATE INDEX idx_lesson_signals_created ON public.lesson_signals(created_at DESC);

ALTER TABLE public.lesson_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_signals_select" ON public.lesson_signals
  FOR SELECT USING (public.can_access_learner(learner_id));

CREATE POLICY "lesson_signals_insert_own" ON public.lesson_signals
  FOR INSERT WITH CHECK (learner_id = auth.uid());
