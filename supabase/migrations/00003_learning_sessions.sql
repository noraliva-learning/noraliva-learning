-- Learning sessions: one row per active/completed session per learner.
CREATE TABLE public.learning_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX idx_learning_sessions_learner ON public.learning_sessions(learner_id);
CREATE INDEX idx_learning_sessions_status ON public.learning_sessions(status);

ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learning_sessions_select_own" ON public.learning_sessions
  FOR SELECT USING (learner_id = auth.uid());

CREATE POLICY "learning_sessions_insert_own" ON public.learning_sessions
  FOR INSERT WITH CHECK (learner_id = auth.uid());

CREATE POLICY "learning_sessions_update_own" ON public.learning_sessions
  FOR UPDATE USING (learner_id = auth.uid());
