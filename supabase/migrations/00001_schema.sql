-- Phase 2A: Liv & Elle Elite Learning System — Core schema
-- Run in Supabase SQL Editor or via supabase db push

-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PROFILES (auth users: parent, liv, elle). id = auth.uid().
-- =============================================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('parent', 'liv', 'elle')),
  display_name text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  age int,
  grade_label text,
  challenge_style text NOT NULL DEFAULT 'gentle' CHECK (challenge_style IN ('strict', 'gentle')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Auth users: parent and learners (liv/elle). No public signup; parent creates child accounts.';

-- Learners: convenience view for liv/elle only
CREATE OR REPLACE VIEW public.learners AS
  SELECT id, role, display_name, parent_id, age, grade_label, challenge_style, created_at, updated_at
  FROM public.profiles
  WHERE role IN ('liv', 'elle');

-- =============================================================================
-- DOMAINS & SKILLS
-- =============================================================================
CREATE TABLE public.domains (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain_id, slug)
);

-- =============================================================================
-- LESSONS & EXERCISES
-- =============================================================================
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.exercises (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- LEARNER ACTIVITY: ATTEMPTS, MASTERY, MISCONCEPTIONS, REVIEW, XP/STREAK
-- =============================================================================
CREATE TABLE public.attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attempts_learner ON public.attempts(learner_id);
CREATE INDEX idx_attempts_created ON public.attempts(created_at);

CREATE TABLE public.skill_mastery (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  level int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(learner_id, skill_id)
);

CREATE TABLE public.misconceptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.review_schedule (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  next_review_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(learner_id, skill_id)
);

CREATE TABLE public.xp_streaks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  xp int NOT NULL DEFAULT 0,
  streak int NOT NULL DEFAULT 0,
  challenge_day int NOT NULL DEFAULT 0,
  last_completed_date date,
  committed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(learner_id, domain_id)
);

CREATE INDEX idx_xp_streaks_learner ON public.xp_streaks(learner_id);

-- =============================================================================
-- GENERATED CONTENT & CHAT (parent viewable)
-- =============================================================================
CREATE TABLE public.generated_content_metadata (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_type text NOT NULL,
  external_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_logs_learner ON public.chat_logs(learner_id);
CREATE INDEX idx_chat_logs_created ON public.chat_logs(created_at);

-- =============================================================================
-- TRIGGERS: updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.domains FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.skills FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.skill_mastery FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.review_schedule FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.xp_streaks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- SEED: domains (match prototype)
-- =============================================================================
INSERT INTO public.domains (slug, name) VALUES
  ('math', 'Math'),
  ('reading', 'Reading'),
  ('writing', 'Writing'),
  ('architecture', 'Architecture'),
  ('spanish', 'Spanish')
ON CONFLICT (slug) DO NOTHING;
