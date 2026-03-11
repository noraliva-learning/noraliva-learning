/**
 * Database types for Phase 2A (Liv & Elle Elite Learning System).
 * Keep in sync with supabase/migrations.
 */

export type AppRole = "parent" | "liv" | "elle";

export interface Profile {
  id: string;
  role: AppRole;
  display_name: string;
  parent_id: string | null;
  age: number | null;
  grade_label: string | null;
  challenge_style: "strict" | "gentle";
  created_at: string;
  updated_at: string;
}

export interface Domain {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  domain_id: string;
  slug: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type SkillDifficulty = 'easy' | 'medium' | 'hard';

export interface Skill {
  id: string;
  domain_id: string;
  unit_id: string | null;
  slug: string;
  name: string;
  sort_order: number;
  difficulty?: SkillDifficulty | null;
  created_at: string;
  updated_at: string;
}

/** PASS 1: prerequisite edge; prerequisite is met when learner mastery_probability >= 0.85. */
export interface SkillPrerequisite {
  id: string;
  skill_id: string;
  prerequisite_skill_id: string;
  created_at: string;
}

export interface Lesson {
  id: string;
  skill_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: string;
  lesson_id: string;
  prompt: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Attempt {
  id: string;
  learner_id: string;
  exercise_id: string;
  correct: boolean;
  created_at: string;
}

export interface SkillMastery {
  id: string;
  learner_id: string;
  skill_id: string;
  level: number;
  updated_at: string;
}

export interface Misconception {
  id: string;
  learner_id: string;
  skill_id: string | null;
  note: string;
  created_at: string;
}

/** Per-attempt misconception tag (Phase 2). */
export interface AttemptMisconception {
  id: string;
  attempt_id: string;
  learner_id: string;
  skill_id: string;
  tag: string;
  exercise_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Session path choice for spiral planner. */
export type SessionPath = "level_up" | "review";

export interface LearningSession {
  id: string;
  learner_id: string;
  domain: string;
  status: "active" | "completed";
  started_at: string;
  ended_at: string | null;
  path: SessionPath | null;
  session_plan: string[] | null;
  current_index: number;
}

export interface ReviewSchedule {
  id: string;
  learner_id: string;
  skill_id: string;
  next_review_at: string;
  created_at: string;
  updated_at: string;
}

export interface XpStreak {
  id: string;
  learner_id: string;
  domain_id: string;
  xp: number;
  streak: number;
  challenge_day: number;
  last_completed_date: string | null;
  committed: boolean;
  updated_at: string;
}

export interface GeneratedContentMetadata {
  id: string;
  content_type: string;
  external_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChatLog {
  id: string;
  learner_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/** ACE tutor transcript row (Dan/Lila); parent can review. */
export interface TutorTranscriptRow {
  id: string;
  learner_id: string;
  session_id: string | null;
  created_at: string;
  helper_name: string;
  role: "learner" | "tutor" | "system";
  content: string;
  input_source: "text" | "voice" | null;
  metadata: Record<string, unknown>;
}
