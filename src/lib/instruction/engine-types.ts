/**
 * Phase 3: Ace Instruction Engine — input types.
 */

import type { SupportLevel, Modality } from './lesson-plan-schema';
import type { LessonPlan } from './lesson-plan-schema';
import type { LessonScene } from './scene-schema';

export type LearnerSlug = 'liv' | 'elle';

export interface MasterySnapshot {
  skill_id: string;
  mastery_probability: number;
  confidence_score: number;
  next_review_at: string | null;
  spaced_check_count: number;
}

export interface RecentAttempt {
  exercise_id: string;
  skill_id: string;
  correct: boolean;
  created_at: string;
  response_time_ms?: number;
}

export interface MisconceptionRecord {
  skill_id: string | null;
  tag: string;
  created_at: string;
}

/** Phase 5: derived insight for Ace to read */
export interface LearnerInsightSummary {
  insight_type: string;
  summary_plain_english: string;
}

export interface InstructionEngineInput {
  learner_id: string;
  learner_slug?: LearnerSlug;
  domain: string;
  current_mastery: MasterySnapshot[];
  recent_attempts: RecentAttempt[];
  misconception_history: MisconceptionRecord[];
  hint_usage: { skill_id: string; count: number }[];
  response_speed_avg_ms?: number | null;
  frustration_signals?: boolean;
  recent_review_schedule: { skill_id: string; next_review_at: string }[];
  candidate_skill_id?: string | null;
  candidate_skill_name?: string | null;
  /** Phase 5: learning-signal-derived insights (modality, hint dependence, guided vs independent, etc.) */
  learner_insights?: LearnerInsightSummary[];
}

export interface InstructionEngineOutput {
  plan: LessonPlan;
  scenes: LessonScene[];
}

/** Default support level and modality by learner (overridable by engine) */
export interface LearnerInstructionDefaults {
  support_level: SupportLevel;
  modality: Modality;
  prefer_shorter_chunks: boolean;
  prefer_more_visual: boolean;
  prefer_more_read_aloud: boolean;
  progression_speed: 'faster' | 'standard' | 'slower';
  transfer_prompts: boolean;
}
