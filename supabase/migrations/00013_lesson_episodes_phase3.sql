-- Phase 3: Ace Instruction Engine — persist generated lesson plans and episode progress.
-- One row per teaching episode (one lesson plan per learner/skill/domain).

CREATE TABLE public.lesson_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain text NOT NULL,
  skill text NOT NULL,
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  lesson_plan_json jsonb NOT NULL,
  scene_sequence jsonb NOT NULL DEFAULT '[]',
  generated_by text NOT NULL DEFAULT 'deterministic' CHECK (generated_by IN ('openai', 'deterministic')),
  version text NOT NULL DEFAULT '1.0',
  support_level text,
  promotion_decision text CHECK (promotion_decision IN ('advance', 'hold', 'review')),
  completion_status text NOT NULL DEFAULT 'in_progress' CHECK (completion_status IN ('in_progress', 'completed')),
  current_scene_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lesson_episodes IS 'Phase 3: Teaching episode from Ace Instruction Engine; stores plan + progress.';
COMMENT ON COLUMN public.lesson_episodes.lesson_plan_json IS 'Full lesson plan (skill, support_level, scene_sequence, hint_ladder, etc.).';
COMMENT ON COLUMN public.lesson_episodes.scene_sequence IS 'Ordered array of scene objects for rendering.';
COMMENT ON COLUMN public.lesson_episodes.completion_status IS 'in_progress until learner finishes last scene.';

CREATE INDEX idx_lesson_episodes_learner ON public.lesson_episodes(learner_id);
CREATE INDEX idx_lesson_episodes_domain ON public.lesson_episodes(domain);
CREATE INDEX idx_lesson_episodes_created ON public.lesson_episodes(created_at DESC);

ALTER TABLE public.lesson_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_episodes_select_own" ON public.lesson_episodes
  FOR SELECT USING (learner_id = auth.uid());

CREATE POLICY "lesson_episodes_insert_own" ON public.lesson_episodes
  FOR INSERT WITH CHECK (learner_id = auth.uid());

CREATE POLICY "lesson_episodes_update_own" ON public.lesson_episodes
  FOR UPDATE USING (learner_id = auth.uid());
