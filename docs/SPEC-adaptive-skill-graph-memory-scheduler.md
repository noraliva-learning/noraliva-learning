# Noraliva Learning Engine Upgrade — Implementation Spec

**Branch:** `preview/adaptive-skill-graph-memory-scheduler`  
**Scope:** True Adaptive Skill Graph, Misconception Memory, Spaced Retrieval Scheduler  
**Status:** Spec only — no code changes until approved.

---

## 1. Architecture Overview

### Current State (Summary)

- **Skills:** `skills` table has `domain_id`, `unit_id`, `slug`, `name`, `sort_order`. No prerequisites or explicit difficulty. Progression is implicit via curriculum order (units → skills by sort_order).
- **Mastery:** `skill_mastery` holds Bayesian state (`mastery_probability`, `confidence_score`, `attempts_count`, `last_attempt_at`, `next_review_at`, `spaced_check_count`). **Dual storage:** `review_schedule` (learner_id, skill_id, next_review_at) is also written on every attempt; both are read when computing due reviews.
- **Misconceptions:** Legacy `misconceptions` (learner_id, skill_id, note) exists but is unused for session logic. Phase 2 uses `attempt_misconceptions` (per-attempt: attempt_id, learner_id, skill_id, tag, exercise_id, metadata). Used for: (1) struggle detection (≥3 same tag in recent window), (2) AI context (recent tags for generation), (3) micro-lessons.
- **Session flow:** Start session → POST `/api/v2/session/plan` (loads domain exercises + mastery + due reviews, runs spiral planner) → session_plan stored on `learning_sessions` → attempt/next/submit-answer consume plan. Next-skill choice: due reviews first, then edge-of-learning by `edgeOfLearningScore`, then curriculum order. No prerequisite checks.
- **Spaced review:** `scheduleNextReview()` in masteryEngine: correct → 7–14 days (building) or 30–90 days (high mastery); incorrect → 10 min. Only two effective windows; no explicit short/medium/long tiers.

### Target Architecture (Additive Where Possible)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Session Engine (unchanged flow)                   │
│  start → plan → attempt / next / submit-answer                           │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Plan / Next-Skill Selection (enhanced)                                  │
│  • Skill graph: filter by prerequisites (new)                            │
│  • Next best skill: edge + mastery + misconception history (enhanced)     │
│  • Spaced scheduler: due items from unified schedule (enhanced)           │
└─────────────────────────────────────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌─────────┐   ┌─────────────┐   ┌─────────────────────┐
│ Skill   │   │ Misconception│   │ Spaced Retrieval    │
│ Graph   │   │ Memory       │   │ Scheduler           │
│ (new)   │   │ (enhanced)   │   │ (enhanced)          │
└─────────┘   └─────────────┘   └─────────────────────┘
    │               │                       │
    ▼               ▼                       ▼
 DB: skill_     DB: attempt_          DB: skill_mastery
 prerequisites  misconceptions       + review_schedule
 + skills       + new summary/        (or single source)
  (difficulty)   aggregation
```

- **Skill graph:** New table for prerequisites; optional `difficulty` on skills. All “next skill” and “session plan” logic that today uses curriculum order will additionally filter by “prerequisites met” and can weight by difficulty/mastery.
- **Misconception memory:** Keep `attempt_misconceptions` as source of truth. Add a **misconception summary** (new table or materialized view) per learner per skill: repeated tags over time, last_seen, count. Session engine and AI get “repeated misconception patterns” from this; remediation can target recurring tags.
- **Spaced retrieval:** Introduce explicit short/medium/long windows and a single source of truth for “next review” (recommend consolidating on `skill_mastery.next_review_at` and optionally deprecating duplicate writes to `review_schedule` later). Scheduler uses mastery + misconception history + last_seen_at to compute next_review_at and to surface “due” items for session generation.

---

## 2. Tables / Columns to Add or Modify

### 2.1 True Adaptive Skill Graph

| Change | Table | Detail |
|--------|--------|--------|
| **Add** | `skill_prerequisites` | `id`, `skill_id` (FK skills), `prerequisite_skill_id` (FK skills), `created_at`. UNIQUE(skill_id, prerequisite_skill_id). Enforces DAG (application-level or trigger). |
| **Add** | `skills` | `difficulty` text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')) — optional; enables “per-skill difficulty” and future weighting. |

- **Additive:** Existing skills get no prerequisites (all remain eligible by current logic). New/updated curriculum can add rows to `skill_prerequisites` and set `difficulty`.
- **RLS:** `skill_prerequisites` and `skills` are curriculum data: same as existing skills (read for authenticated; write via migrations or admin).

### 2.2 Misconception Memory

| Change | Table | Detail |
|--------|--------|--------|
| **Add** | `learner_skill_misconception_summary` | `learner_id`, `skill_id`, `tag`, `occurrence_count`, `first_seen_at`, `last_seen_at`, `updated_at`. PK (learner_id, skill_id, tag). Aggregated from `attempt_misconceptions`; updated on insert (trigger or app). |

- **Alternative:** No new table; add a **function** `get_learner_skill_misconception_summary(learner_id, skill_id)` that aggregates from `attempt_misconceptions` (count per tag, first/last seen). Simpler, no sync; slightly heavier reads.
- **Recommendation:** Implement function first (additive, no schema change). Add summary table in a follow-up migration if we need fast “repeated pattern” queries across many skills (e.g. dashboard).

### 2.3 Spaced Retrieval Scheduler

| Change | Table | Detail |
|--------|--------|--------|
| **Keep** | `skill_mastery` | Already has `next_review_at`, `last_attempt_at`. Add optional `review_window` text: 'short' \| 'medium' \| 'long' for analytics; scheduler logic can derive window from mastery + misconception. |
| **Optional** | `review_schedule` | Today both `skill_mastery.next_review_at` and `review_schedule.next_review_at` are written. **Recommendation:** Keep writing both for now (no behavior change). In a later pass, consolidate reads to `skill_mastery` only and stop writing `review_schedule` (deprecate). |

- **No new tables required** for basic short/medium/long behavior: derive next review date in code from `scheduleNextReview()` extended with window tiers and misconception recency.

### 2.4 Migration Filenames (Proposed)

- `00011_skill_graph_prerequisites_difficulty.sql` — skill_prerequisites, skills.difficulty.
- `00012_learner_skill_misconception_summary.sql` — optional; only if we add materialized summary. Otherwise skip and use function.

---

## 3. Key Functions / Modules to Add or Modify

### 3.1 Skill Graph (New)

| Module | Purpose |
|--------|--------|
| **`src/lib/curriculum/skillGraph.ts`** (new) | `getSkillPrerequisites(skillId)`, `getSkillsWithPrerequisitesMet(learnerId, domainId)`. Uses `skill_prerequisites` and learner’s `skill_mastery` (e.g. prerequisite “met” if mastery_probability >= threshold or attempted). |
| **`src/lib/curriculum/nextExerciseLogic.ts`** | **Modify:** Filter candidate skills to those with prerequisites met before applying due-review / edge-of-learning / curriculum order. |
| **`src/lib/db/loadSessionPlanData.ts`** | **Modify:** When loading domain skills/exercises, optionally filter skills to those with prerequisites met (or keep all and let planner weight by readiness). Prefer filtering so session_plan never suggests locked skills. |

### 3.2 Misconception Memory (New + Modify)

| Module | Purpose |
|--------|--------|
| **`src/lib/db/misconceptions.ts`** | **Add:** `getRepeatedMisconceptionPatterns(learnerId, skillId?)` — return tags with occurrence_count and last_seen_at (from new function or summary table). Used by session engine and AI. |
| **`src/lib/session/sessionPlanner.ts`** | **Modify (optional):** Accept “skills with repeated misconceptions” and bias plan toward those for remediation (e.g. extra slot or higher weight in reinforcement bucket). |
| **`src/lib/ai/getLearnerContextForAI.ts`** | **Modify:** Include repeated misconception patterns (tag + count + last_seen) in context so AI can target remediation. |
| **Struggle / micro-lesson** | **Keep:** Existing `getRecentMisconceptionCounts` + `isStruggling` (≥3 same tag) and micro-lesson on submit; add “repeated over time” as additional signal for planning, not replace. |

### 3.3 Spaced Retrieval Scheduler (Modify)

| Module | Purpose |
|--------|--------|
| **`src/lib/mastery/masteryEngine.ts`** | **Modify:** Extend `scheduleNextReview(correct, masteryProbability, now, options?)` with explicit **short** (e.g. 1–3 days), **medium** (7–14 days), **long** (30–90 days). Optionally take `recentMisconceptionCount` or `lastMisconceptionAt` to shorten interval when misconceptions are recent. |
| **`src/lib/db/submitAttemptForSession.ts`** | **Modify:** Call updated `scheduleNextReview` with misconception context (e.g. count of same-tag in last N attempts) so incorrect + repeated misconception can schedule sooner. Continue writing both `skill_mastery` and `review_schedule`. |
| **`src/lib/db/loadSessionPlanData.ts`** / **`getNextExercise.ts`** | **No schema change:** Continue considering a skill “due” when `next_review_at <= now`. Scheduler’s job is to set `next_review_at`; session plan already consumes it. |

### 3.4 Session Engine (Integration Only)

| Area | Change |
|------|--------|
| **Plan route** | Already uses `loadSessionPlanData` → `generateSessionPlan`. Once `loadSessionPlanData` filters by prerequisites and optionally includes “repeated misconception” skills, plan will reflect it. No change to route contract. |
| **Submit-answer / attempt** | Already updates mastery and review; will call enhanced `scheduleNextReview` and optionally update misconception summary if we add it. |
| **Next / attempt** | No change; they consume session_plan and current_index. |

---

## 4. Session Engine Changes (Summary)

- **Flow:** Unchanged. Start → plan → attempt / next / submit-answer.
- **Plan content:** Skills included in the plan are restricted to those with **prerequisites met** (new). Within that set, spiral mix (edge / reinforcement / easy) and path (level_up / review) unchanged; optional **remediation bias**: if a skill has repeated misconception pattern, allow planner to add weight or an extra slot for that skill.
- **Due reviews:** Still derived from `next_review_at <= now` (skill_mastery or review_schedule). Spaced scheduler only changes how `next_review_at` is computed (short/medium/long + misconception awareness).
- **Auth / RLS:** No change. All new tables use existing patterns (e.g. `can_access_learner` for learner-scoped data; curriculum tables read-only authenticated).

---

## 5. Migration Plan

1. **Branch:** Already on `preview/adaptive-skill-graph-memory-scheduler`.
2. **Migration 00011:** Add `skill_prerequisites`, add `skills.difficulty` (nullable then backfill default 'medium' if desired).
3. **Migration 00012 (optional):** Add `learner_skill_misconception_summary` and trigger/function to maintain it from `attempt_misconceptions`; or skip and use aggregation function only.
4. **App code:** Implement skill graph helpers, then prerequisite filtering in loadSessionPlanData and nextExerciseLogic; then misconception summary (function or table) and exposure in session planner + AI context; then extended scheduleNextReview and call from submitAttemptForSession.
5. **Verification:** Run existing tests; add unit tests for prerequisite filtering, misconception summary, and scheduler windows. E2E: start session → plan → submit answers and confirm due dates and plan content.
6. **Preview deploy:** Push branch; verify on Vercel preview; then merge to main after approval.

---

## 6. Testing Plan

| Area | Tests |
|------|--------|
| **Skill graph** | Unit: `getSkillsWithPrerequisitesMet` with mock DB (no prereq; one prereq met; one prereq not met). Integration: plan returns only skills with prerequisites met when prereqs exist. |
| **Misconception memory** | Unit: `getRepeatedMisconceptionPatterns` returns tags with counts and last_seen; session planner includes remediation bias when patterns exist. AI context includes repeated patterns. |
| **Spaced scheduler** | Unit: `scheduleNextReview` with short/medium/long and optional misconception input; verify intervals. Integration: after submit, `next_review_at` and (if kept) `review_schedule` updated with new logic. |
| **Regression** | Existing session flow tests (sessionPlanner.test.ts, nextExerciseLogic.test.ts, session-api tests, e2e session-flow) must pass. |
| **RLS** | New tables (if any) have correct policies; no cross-learner data leak. |

---

## 7. Rollout Plan

1. **Preview branch:** All work on `preview/adaptive-skill-graph-memory-scheduler`; no direct push to main.
2. **Feature flags (optional):** If desired, gate “prerequisite filtering” and “remediation bias” behind env or config so preview can A/B or disable without deploy.
3. **Deploy preview:** Push branch → Vercel preview URL → verify plan content, due reviews, and submit flow.
4. **Merge to main:** After approval, merge; production deploy via Vercel. Migrations run on Supabase on next deploy or manual run.
5. **Post-merge:** Monitor errors and review_schedule/skill_mastery consistency; plan deprecation of duplicate review_schedule write in a later pass if we consolidate.

---

## 8. Risks / Tradeoffs

| Risk | Mitigation |
|------|------------|
| Prerequisite cycles or invalid DAG | Application-level check before insert; optional DB trigger to prevent cycles. Seed data reviewed in migration. |
| Performance: prerequisite check per plan | Cache skill graph (prerequisites) per domain; filter in memory. Keep queries minimal (one query for prereqs per domain). |
| Misconception summary stale if we add table | Update via trigger on `attempt_misconceptions` insert, or periodic job. Prefer function-based aggregation in v1 to avoid sync bugs. |
| Dual review_schedule + skill_mastery | Keep both in sync in this pass; document as tech debt; consolidate in a later migration (single source: skill_mastery). |
| Breaking existing sessions | Additive: no prerequisite = all skills eligible. Existing sessions and plans continue to work. |

---

## 9. Recommendation: One Pass vs Two Passes

**Recommendation: One pass on preview branch, with clear internal phases.**

- **Single branch** keeps schema and code in sync and avoids long-lived drift. The changes are additive (prerequisites, misconception summary API, scheduler extension); the current V2 session loop stays intact.
- **Phases within the pass:**
  1. **Schema:** Migration 00011 (skill_prerequisites, skills.difficulty).
  2. **Skill graph:** Implement skillGraph.ts and prerequisite filtering in loadSessionPlanData + nextExerciseLogic; tests.
  3. **Misconception memory:** Implement getRepeatedMisconceptionPatterns (function over attempt_misconceptions); plug into getLearnerContextForAI and optional sessionPlanner remediation bias; tests.
  4. **Spaced scheduler:** Extend scheduleNextReview (short/medium/long + misconception); update submitAttemptForSession; tests.
  5. **Integration:** Full session E2E; RLS check; deploy preview.

If timelines are tight, a **two-pass** split is possible: **Pass 1:** Skill graph + prerequisite filtering only. **Pass 2:** Misconception memory (repeated patterns) + spaced retrieval scheduler. Same branch, two PRs/merges; pass 2 builds on pass 1 schema.

---

## 10. Approval Checklist

- [ ] Architecture and tables approved.
- [ ] Preference: one pass vs two passes confirmed.
- [ ] Preference: misconception summary as function only vs new table (with trigger) confirmed.
- [ ] Ready to implement on `preview/adaptive-skill-graph-memory-scheduler` (no code until then).
