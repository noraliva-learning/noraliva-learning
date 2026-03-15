-- Phase 4: Work Mat — persist workmat state and validation per episode.
ALTER TABLE public.lesson_episodes
  ADD COLUMN IF NOT EXISTS workmat_output jsonb DEFAULT NULL;

COMMENT ON COLUMN public.lesson_episodes.workmat_output IS 'Phase 4: Saved work mat state (strokes, placements, connections) and validation result when work mat was used.';
