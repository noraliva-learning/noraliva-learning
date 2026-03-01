-- Noraliva Mastery Engine: extend skill_mastery with Bayesian mastery and spaced repetition.
-- Keeps existing (learner_id, skill_id, level, updated_at); adds mastery_probability, confidence_score,
-- attempts_count, last_attempt_at, next_review_at.

ALTER TABLE public.skill_mastery
  ADD COLUMN IF NOT EXISTS mastery_probability double precision NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS confidence_score double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attempts_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_review_at timestamptz;

COMMENT ON COLUMN public.skill_mastery.mastery_probability IS 'Bayesian estimate of P(correct) for this skill.';
COMMENT ON COLUMN public.skill_mastery.confidence_score IS 'Inverse of posterior variance; grows with attempts.';
COMMENT ON COLUMN public.skill_mastery.attempts_count IS 'Total attempts for this learner/skill.';
COMMENT ON COLUMN public.skill_mastery.next_review_at IS 'When to next show this skill for spaced repetition.';

-- Backfill existing rows: set last_attempt_at from updated_at, next_review_at = now() so they can be reviewed
UPDATE public.skill_mastery
SET
  last_attempt_at = COALESCE(last_attempt_at, updated_at),
  next_review_at = COALESCE(next_review_at, now())
WHERE last_attempt_at IS NULL OR next_review_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_skill_mastery_next_review
  ON public.skill_mastery(learner_id, next_review_at)
  WHERE next_review_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_skill_mastery_learner_skill
  ON public.skill_mastery(learner_id, skill_id);
