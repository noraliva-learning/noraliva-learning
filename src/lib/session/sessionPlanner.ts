/**
 * Session plan generator: spiral model (70% edge, 20% reinforcement, 10% easy).
 * Interleaves skills; supports two paths (Level Up vs Review & Shine).
 * Phase 2: deterministic, no AI.
 */

import { edgeOfLearningScore } from '@/lib/mastery/masteryEngine';
import type { SessionPath } from '@/lib/supabase/types';

export type ExerciseForPlan = {
  id: string;
  skill_id: string;
  prompt: string;
};

export type MasteryForPlan = {
  mastery_probability: number;
  confidence_score: number;
  next_review_at: string | null;
  spaced_check_count: number;
};

export type SessionPlanInput = {
  exercises: ExerciseForPlan[];
  masteryBySkill: Map<string, MasteryForPlan>;
  dueReviewSkillIds: Set<string>;
  path: SessionPath;
  /** Target session length (approx questions). Default 6-12. */
  minItems?: number;
  maxItems?: number;
  now?: string;
};

const DEFAULT_MIN = 6;
const DEFAULT_MAX = 12;
const EDGE_MASTERY_MIN = 0.55;
const EDGE_MASTERY_MAX = 0.8;
const REINFORCEMENT_MAX = 0.92;

function bucket(
  exercises: ExerciseForPlan[],
  masteryBySkill: Map<string, MasteryForPlan>,
  dueReviewSkillIds: Set<string>,
  now: string
): { edge: ExerciseForPlan[]; reinforcement: ExerciseForPlan[]; easy: ExerciseForPlan[] } {
  const edge: ExerciseForPlan[] = [];
  const reinforcement: ExerciseForPlan[] = [];
  const easy: ExerciseForPlan[] = [];

  const seenSkillInBucket = new Set<string>();
  for (const ex of exercises) {
    const m = masteryBySkill.get(ex.skill_id);
    const prob = m?.mastery_probability ?? 0.3;
    const due = dueReviewSkillIds.has(ex.skill_id);

    if (prob >= REINFORCEMENT_MAX) {
      easy.push(ex);
    } else if (due || (prob >= EDGE_MASTERY_MAX && prob < REINFORCEMENT_MAX)) {
      reinforcement.push(ex);
    } else if (prob >= EDGE_MASTERY_MIN && prob <= EDGE_MASTERY_MAX) {
      edge.push(ex);
    } else {
      // Below edge: treat as edge for "new" content
      edge.push(ex);
    }
  }

  return { edge, reinforcement, easy };
}

/** Dedupe by skill: one exercise per skill in order, then fill with remaining. */
function dedupeBySkill(exercises: ExerciseForPlan[]): ExerciseForPlan[] {
  const bySkill = new Map<string, ExerciseForPlan[]>();
  for (const ex of exercises) {
    const list = bySkill.get(ex.skill_id) ?? [];
    list.push(ex);
    bySkill.set(ex.skill_id, list);
  }
  const out: ExerciseForPlan[] = [];
  const done = new Set<string>();
  for (const ex of exercises) {
    if (done.has(ex.skill_id)) continue;
    const list = bySkill.get(ex.skill_id)!;
    out.push(list[0]);
    done.add(ex.skill_id);
  }
  for (const ex of exercises) {
    if (!done.has(ex.skill_id)) continue;
    const list = bySkill.get(ex.skill_id)!;
    for (let i = 1; i < list.length; i++) out.push(list[i]);
  }
  return out;
}

/**
 * Interleave so same skill does not appear back-to-back when possible.
 * Picks one from each bucket in round-robin by skill.
 */
function interleave(edge: ExerciseForPlan[], reinforcement: ExerciseForPlan[], easy: ExerciseForPlan[]): ExerciseForPlan[] {
  const result: ExerciseForPlan[] = [];
  const queues = [edge, reinforcement, easy].map((arr) => [...arr]);
  let lastSkill: string | null = null;

  while (queues.some((q) => q.length > 0)) {
    let chosen: ExerciseForPlan | null = null;
    let chosenQueue = -1;
    for (let i = 0; i < queues.length; i++) {
      const q = queues[i];
      if (q.length === 0) continue;
      const candidate = q[0];
      if (candidate.skill_id !== lastSkill) {
        chosen = candidate;
        chosenQueue = i;
        break;
      }
    }
    if (chosen === null) {
      for (let i = 0; i < queues.length; i++) {
        if (queues[i].length > 0) {
          chosen = queues[i].shift()!;
          break;
        }
      }
    } else {
      queues[chosenQueue].shift();
    }
    if (chosen) {
      result.push(chosen);
      lastSkill = chosen.skill_id;
    } else {
      for (let i = 0; i < queues.length; i++) {
        if (queues[i].length > 0) {
          const fallback = queues[i].shift()!;
          result.push(fallback);
          lastSkill = fallback.skill_id;
          break;
        }
      }
    }
  }
  return result;
}

/**
 * Build spiral mix: 70% edge, 20% reinforcement, 10% easy.
 * Path "level_up" biases edge (e.g. 80/15/5); "review" biases reinforcement (e.g. 50/40/10).
 */
export function buildSpiralMix(path: SessionPath): { edge: number; reinforcement: number; easy: number } {
  if (path === 'level_up') return { edge: 0.8, reinforcement: 0.15, easy: 0.05 };
  return { edge: 0.5, reinforcement: 0.4, easy: 0.1 };
}

/**
 * Generate ordered exercise list for one session.
 * Respects spiral distribution, interleaves skills, and path choice.
 */
export function generateSessionPlan(input: SessionPlanInput): string[] {
  const {
    exercises,
    masteryBySkill,
    dueReviewSkillIds,
    path,
    minItems = DEFAULT_MIN,
    maxItems = DEFAULT_MAX,
    now = new Date().toISOString(),
  } = input;

  if (exercises.length === 0) return [];

  const { edge, reinforcement, easy } = bucket(exercises, masteryBySkill, dueReviewSkillIds, now);
  const mix = buildSpiralMix(path);
  const total = Math.min(maxItems, Math.max(minItems, Math.ceil(exercises.length * 0.5)));

  const nEdge = Math.round(total * mix.edge);
  const nReinforcement = Math.round(total * mix.reinforcement);
  let nEasy = total - nEdge - nReinforcement;

  const take = (arr: ExerciseForPlan[], n: number) => dedupeBySkill(arr).slice(0, Math.max(0, n));
  const edgeTaken = take(edge, nEdge);
  const reinTaken = take(reinforcement, nReinforcement);
  let easyTaken = take(easy, Math.max(0, nEasy));

  // If we're short of total, fill from remaining pools (no double-count)
  const usedIds = new Set([...edgeTaken, ...reinTaken, ...easyTaken].map((x) => x.id));
  const soFar = usedIds.size;
  if (soFar < total) {
    const remaining = exercises.filter((e) => !usedIds.has(e.id));
    const extra = dedupeBySkill(remaining).slice(0, total - soFar);
    easyTaken = [...easyTaken, ...extra];
  }

  const combined = interleave(edgeTaken, reinTaken, easyTaken);
  const ids = combined.map((e) => e.id);
  const uniqueIds = [...new Set(ids)];
  const result = uniqueIds.slice(0, maxItems);
  // Never return empty when we have exercises: fallback to first N by curriculum order
  if (result.length === 0 && exercises.length > 0) {
    const fallback = dedupeBySkill(exercises)
      .slice(0, maxItems)
      .map((e) => e.id);
    return fallback;
  }
  return result;
}
