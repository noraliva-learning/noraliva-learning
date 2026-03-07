-- AI-generated exercises: store correct_answer and answer_type for server-side evaluation.
-- Enables adaptive engine to persist generated exercises and link attempts.

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS correct_answer text,
  ADD COLUMN IF NOT EXISTS answer_type text;

COMMENT ON COLUMN public.exercises.correct_answer IS 'For AI-generated exercises: expected answer for evaluation.';
COMMENT ON COLUMN public.exercises.answer_type IS 'For AI-generated exercises: e.g. number, short_answer, multiple_choice.';

-- Allow authenticated users (API on behalf of learner) to insert lessons and exercises (AI-generated).
CREATE POLICY "lessons_insert_authenticated" ON public.lessons
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users (API on behalf of learner) to insert exercises (AI-generated).
CREATE POLICY "exercises_insert_authenticated" ON public.exercises
  FOR INSERT TO authenticated WITH CHECK (true);
