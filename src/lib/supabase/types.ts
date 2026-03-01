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

export interface Skill {
  id: string;
  domain_id: string;
  unit_id: string | null;
  slug: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
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
