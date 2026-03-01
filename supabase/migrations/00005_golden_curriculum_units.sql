-- Golden Curriculum: add units and sort_order for deterministic progression.
-- Hierarchy: domain -> unit -> skill -> lesson -> exercise.

-- =============================================================================
-- UNITS
-- =============================================================================
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain_id, slug)
);

CREATE INDEX idx_units_domain ON public.units(domain_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- SKILLS: add unit_id and sort_order
-- =============================================================================
ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- =============================================================================
-- LESSONS & EXERCISES: add sort_order
-- =============================================================================
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- =============================================================================
-- RLS: units (read for authenticated)
-- =============================================================================
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_select_authenticated" ON public.units
  FOR SELECT TO authenticated USING (true);
