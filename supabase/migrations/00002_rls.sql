-- Phase 2A: Row Level Security (RLS)
-- Child (liv/elle): read/write only own learner row + own attempts, mastery, chat.
-- Parent: read/write everything (own profile + all children's data).

-- =============================================================================
-- HELPERS: current user's profile and role
-- =============================================================================
CREATE OR REPLACE FUNCTION public.current_user_profile()
RETURNS public.profiles AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Parent can access a learner if they are the parent of that learner
CREATE OR REPLACE FUNCTION public.is_parent_of(learner_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = learner_uuid AND parent_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Can current user read/write learner's data? (self as learner, or parent of learner)
CREATE OR REPLACE FUNCTION public.can_access_learner(learner_uuid uuid)
RETURNS boolean AS $$
  SELECT auth.uid() = learner_uuid OR public.is_parent_of(learner_uuid);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- ENABLE RLS ON ALL RELEVANT TABLES
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.misconceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_content_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PROFILES
-- =============================================================================
-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Parents can read their children's profiles (parent_id = self)
CREATE POLICY "profiles_select_children" ON public.profiles
  FOR SELECT USING (parent_id = auth.uid());

-- Users can update their own profile (limited fields often enforced in app)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Parents can update their children's profiles
CREATE POLICY "profiles_update_children" ON public.profiles
  FOR UPDATE USING (parent_id = auth.uid());

-- Insert: only service role or trigger from auth.users (see note below)
-- For Phase 2A we allow authenticated users to insert a profile for themselves
-- when they sign up (e.g. from app after first login). Parent-created children
-- are created via service role or a trigger.
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- =============================================================================
-- DOMAINS, SKILLS, LESSONS, EXERCISES (read-only for all authenticated)
-- =============================================================================
CREATE POLICY "domains_select_authenticated" ON public.domains
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "skills_select_authenticated" ON public.skills
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "lessons_select_authenticated" ON public.lessons
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "exercises_select_authenticated" ON public.exercises
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- ATTEMPTS: learner own + parent of learner
-- =============================================================================
CREATE POLICY "attempts_select" ON public.attempts
  FOR SELECT USING (public.can_access_learner(learner_id));

CREATE POLICY "attempts_insert" ON public.attempts
  FOR INSERT WITH CHECK (public.can_access_learner(learner_id));

CREATE POLICY "attempts_update" ON public.attempts
  FOR UPDATE USING (public.can_access_learner(learner_id));

CREATE POLICY "attempts_delete" ON public.attempts
  FOR DELETE USING (public.can_access_learner(learner_id));

-- =============================================================================
-- SKILL_MASTERY
-- =============================================================================
CREATE POLICY "skill_mastery_select" ON public.skill_mastery
  FOR SELECT USING (public.can_access_learner(learner_id));

CREATE POLICY "skill_mastery_insert" ON public.skill_mastery
  FOR INSERT WITH CHECK (public.can_access_learner(learner_id));

CREATE POLICY "skill_mastery_update" ON public.skill_mastery
  FOR UPDATE USING (public.can_access_learner(learner_id));

CREATE POLICY "skill_mastery_delete" ON public.skill_mastery
  FOR DELETE USING (public.can_access_learner(learner_id));

-- =============================================================================
-- MISCONCEPTIONS
-- =============================================================================
CREATE POLICY "misconceptions_select" ON public.misconceptions
  FOR SELECT USING (public.can_access_learner(learner_id));

CREATE POLICY "misconceptions_insert" ON public.misconceptions
  FOR INSERT WITH CHECK (public.can_access_learner(learner_id));

CREATE POLICY "misconceptions_update" ON public.misconceptions
  FOR UPDATE USING (public.can_access_learner(learner_id));

CREATE POLICY "misconceptions_delete" ON public.misconceptions
  FOR DELETE USING (public.can_access_learner(learner_id));

-- =============================================================================
-- REVIEW_SCHEDULE
-- =============================================================================
CREATE POLICY "review_schedule_select" ON public.review_schedule
  FOR SELECT USING (public.can_access_learner(learner_id));

CREATE POLICY "review_schedule_insert" ON public.review_schedule
  FOR INSERT WITH CHECK (public.can_access_learner(learner_id));

CREATE POLICY "review_schedule_update" ON public.review_schedule
  FOR UPDATE USING (public.can_access_learner(learner_id));

CREATE POLICY "review_schedule_delete" ON public.review_schedule
  FOR DELETE USING (public.can_access_learner(learner_id));

-- =============================================================================
-- XP_STREAKS
-- =============================================================================
CREATE POLICY "xp_streaks_select" ON public.xp_streaks
  FOR SELECT USING (public.can_access_learner(learner_id));

CREATE POLICY "xp_streaks_insert" ON public.xp_streaks
  FOR INSERT WITH CHECK (public.can_access_learner(learner_id));

CREATE POLICY "xp_streaks_update" ON public.xp_streaks
  FOR UPDATE USING (public.can_access_learner(learner_id));

CREATE POLICY "xp_streaks_delete" ON public.xp_streaks
  FOR DELETE USING (public.can_access_learner(learner_id));

-- =============================================================================
-- GENERATED_CONTENT_METADATA (read for all authenticated; write via service role or app)
-- =============================================================================
CREATE POLICY "generated_content_select" ON public.generated_content_metadata
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- CHAT_LOGS (learner own + parent viewable)
-- =============================================================================
CREATE POLICY "chat_logs_select" ON public.chat_logs
  FOR SELECT USING (public.can_access_learner(learner_id));

CREATE POLICY "chat_logs_insert" ON public.chat_logs
  FOR INSERT WITH CHECK (public.can_access_learner(learner_id));

CREATE POLICY "chat_logs_update" ON public.chat_logs
  FOR UPDATE USING (public.can_access_learner(learner_id));

CREATE POLICY "chat_logs_delete" ON public.chat_logs
  FOR DELETE USING (public.can_access_learner(learner_id));
