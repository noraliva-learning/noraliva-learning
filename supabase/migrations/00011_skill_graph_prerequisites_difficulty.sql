-- PASS 1: True Adaptive Skill Graph — prerequisites and optional difficulty.
-- Prerequisite met = skill_mastery.mastery_probability >= 0.85 (enforced in app).

-- =============================================================================
-- SKILL_PREREQUISITES
-- =============================================================================
CREATE TABLE public.skill_prerequisites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  prerequisite_skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(skill_id, prerequisite_skill_id),
  CHECK (skill_id != prerequisite_skill_id)
);

CREATE INDEX idx_skill_prerequisites_skill ON public.skill_prerequisites(skill_id);
CREATE INDEX idx_skill_prerequisites_prereq ON public.skill_prerequisites(prerequisite_skill_id);

COMMENT ON TABLE public.skill_prerequisites IS 'DAG: skill_id requires prerequisite_skill_id. Met when learner mastery_probability >= 0.85 for prereq.';

-- =============================================================================
-- SKILLS: optional difficulty
-- =============================================================================
ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'medium'
  CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard'));

COMMENT ON COLUMN public.skills.difficulty IS 'Optional per-skill difficulty for future weighting.';

-- =============================================================================
-- RLS: skill_prerequisites (read-only for authenticated, same as skills)
-- =============================================================================
ALTER TABLE public.skill_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_prerequisites_select_authenticated" ON public.skill_prerequisites
  FOR SELECT TO authenticated USING (true);
