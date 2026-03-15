-- Phase 5: Derived learner insights — plain-English summaries per learner/domain.
CREATE TABLE public.learner_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain text NOT NULL,
  insight_type text NOT NULL,
  summary_plain_english text NOT NULL,
  evidence_summary jsonb DEFAULT '{}',
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(learner_id, domain, insight_type)
);

COMMENT ON TABLE public.learner_insights IS 'Phase 5: Derived insights (e.g. learns best with visual modeling, relies on hints) for parent and Ace.';

CREATE INDEX idx_learner_insights_learner_domain ON public.learner_insights(learner_id, domain);

ALTER TABLE public.learner_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_insights_select" ON public.learner_insights
  FOR SELECT USING (public.can_access_learner(learner_id));

CREATE POLICY "learner_insights_insert_own" ON public.learner_insights
  FOR INSERT WITH CHECK (learner_id = auth.uid());

CREATE POLICY "learner_insights_update_own" ON public.learner_insights
  FOR UPDATE USING (learner_id = auth.uid());
