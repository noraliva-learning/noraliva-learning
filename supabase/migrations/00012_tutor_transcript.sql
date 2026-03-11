-- Tutor transcript: every ACE (Dan/Lila) interaction for parent review and reporting.
-- One row per message (learner or tutor); optional metadata (domain, skill, exercise, question, learner answer).

CREATE TABLE public.tutor_transcript (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.learning_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  helper_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('learner', 'tutor', 'system')),
  content text NOT NULL,
  input_source text CHECK (input_source IN ('text', 'voice')),
  metadata jsonb NOT NULL DEFAULT '{}'
);

COMMENT ON TABLE public.tutor_transcript IS 'ACE tutor (Dan/Lila) conversation log; parent can review via can_access_learner.';
COMMENT ON COLUMN public.tutor_transcript.input_source IS 'For role=learner: whether message came from text or voice.';
COMMENT ON COLUMN public.tutor_transcript.metadata IS 'Optional: domain, skill_id, exercise_id, current_question, learner_answer_at_time.';

CREATE INDEX idx_tutor_transcript_learner_id ON public.tutor_transcript(learner_id);
CREATE INDEX idx_tutor_transcript_created_at ON public.tutor_transcript(created_at);
CREATE INDEX idx_tutor_transcript_session_id ON public.tutor_transcript(session_id);

ALTER TABLE public.tutor_transcript ENABLE ROW LEVEL SECURITY;

-- Parent can read children's transcripts; learner can read own.
CREATE POLICY "tutor_transcript_select" ON public.tutor_transcript
  FOR SELECT USING (public.can_access_learner(learner_id));

-- Only the learner (their session) can insert their own transcript rows.
CREATE POLICY "tutor_transcript_insert" ON public.tutor_transcript
  FOR INSERT WITH CHECK (learner_id = auth.uid());

-- No update/delete for audit integrity (or restrict to admin if needed later).
-- CREATE POLICY "tutor_transcript_update" ...
-- CREATE POLICY "tutor_transcript_delete" ...
