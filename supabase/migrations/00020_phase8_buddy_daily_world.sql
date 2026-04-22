-- Phase 8: Buddy selection, daily mission, learner events (break requests)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS buddy_slug text;

COMMENT ON COLUMN public.profiles.buddy_slug IS 'Child-selected buddy: owl, dinosaur, cupcake, sloth, monster';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_buddy_slug_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_buddy_slug_check CHECK (
    buddy_slug IS NULL OR buddy_slug IN ('owl', 'dinosaur', 'cupcake', 'sloth', 'monster')
  );

CREATE TABLE IF NOT EXISTS public.learner_daily_mission (
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mission_date date NOT NULL,
  practice_events int NOT NULL DEFAULT 0,
  daily_minimum_met boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, mission_date)
);

COMMENT ON TABLE public.learner_daily_mission IS 'Daily rhythm: at least one practice block per day (UTC).';

CREATE INDEX IF NOT EXISTS idx_learner_daily_mission_date ON public.learner_daily_mission(mission_date);

CREATE TABLE IF NOT EXISTS public.learner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.learning_sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_events_learner ON public.learner_events(learner_id, created_at DESC);

COMMENT ON TABLE public.learner_events IS 'Child-facing signals: break_request, etc.';

ALTER TABLE public.learner_daily_mission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_daily_mission_select_own" ON public.learner_daily_mission
  FOR SELECT USING (learner_id = auth.uid());

CREATE POLICY "learner_daily_mission_select_parent" ON public.learner_daily_mission
  FOR SELECT USING (public.is_parent_of(learner_id));

CREATE POLICY "learner_daily_mission_insert_own" ON public.learner_daily_mission
  FOR INSERT WITH CHECK (learner_id = auth.uid());

CREATE POLICY "learner_daily_mission_update_own" ON public.learner_daily_mission
  FOR UPDATE USING (learner_id = auth.uid()) WITH CHECK (learner_id = auth.uid());

CREATE POLICY "learner_events_select_own" ON public.learner_events
  FOR SELECT USING (learner_id = auth.uid());

CREATE POLICY "learner_events_select_parent" ON public.learner_events
  FOR SELECT USING (public.is_parent_of(learner_id));

CREATE POLICY "learner_events_insert_own" ON public.learner_events
  FOR INSERT WITH CHECK (learner_id = auth.uid());
