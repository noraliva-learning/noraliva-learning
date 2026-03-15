-- Phase 5: Allow parent to read child's lesson_episodes for insight/review.
CREATE POLICY "lesson_episodes_select_can_access" ON public.lesson_episodes
  FOR SELECT USING (public.can_access_learner(learner_id));
