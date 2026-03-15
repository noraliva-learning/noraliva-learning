# Phase 3B — Closed-Loop Mastery + Next-Skill Decisioning — Deliverable

## 1. Updated file tree (new/changed)

```
src/
├── lib/
│   ├── instruction/
│   │   ├── completion-schemas.ts       NEW   Lesson completion input/output Zod schemas
│   │   ├── promotion-rules.ts          NEW   advance | hold | review | reteach rules
│   │   ├── lesson-completion-evaluator.ts NEW Server-side evaluator
│   │   ├── lesson-completion-evaluator.test.ts NEW
│   │   ├── promotion-rules.test.ts     NEW
│   │   ├── next-skill-engine.ts        NEW   getNextBestSkillForLearner, getDomainSkillsOrdered
│   │   ├── next-skill-engine.test.ts   NEW
│   │   └── deterministic-builder.ts    CHANGED skill_id from candidate
│   ├── db/
│   │   ├── lessonCompletion.ts         NEW   upsertSkillMastery, upsertReviewSchedule, insertLearnerLessonHistory
│   │   └── getClosedLoopView.ts        NEW   Parent closed-loop view (mastery, decision, next skill, reviews)
│   └── app/
│       ├── api/v2/
│       │   ├── instruction/
│       │   │   ├── generate-plan/route.ts CHANGED Use getNextBestSkillForLearner when no candidate
│       │   │   └── episode/[episodeId]/
│       │   │       ├── complete/route.ts  NEW POST complete -> evaluate, mastery, review, history
│       │   │       └── route.ts           (unchanged)
│       │   ├── parent/closed-loop/route.ts NEW GET ?learnerId=&domain=math
│       │   └── me/route.ts              NEW GET current user id (for E2E)
│       └── v2/learn/lesson/[episodeId]/
│           └── LessonPageClient.tsx     CHANGED Call POST complete with outcome, then redirect
├── components/lesson-scenes/
│   ├── MotionLessonRenderer.tsx        CHANGED Track guidedCorrect, hintUsageCount; LessonCompletionResult type
│   ├── GuidedTryScene.tsx              CHANGED onHintUsed callback
│   ├── IndependentTryScene.tsx         CHANGED onHintUsed callback
│   └── index.ts                        CHANGED Export LessonCompletionResult
supabase/migrations/
└── 00014_learner_lesson_history_phase3b.sql NEW learner_lesson_history table
e2e/
└── lesson-flow.spec.ts                 CHANGED Assert closed-loop data after lesson complete
```

## 2. Migrations

- **`00014_learner_lesson_history_phase3b.sql`**: Creates `learner_lesson_history` (learner_id, episode_id, domain, skill_id, skill_name, promotion_decision, mastery_before, mastery_after, confidence_before, confidence_after, next_skill_id, next_skill_reason, next_skill_why, created_at). RLS: select via can_access_learner, insert by learner.

**Apply:** `npx supabase db push` or run the migration in your Supabase project.

## 3. Test steps

- **Unit tests:** `npm run test` — includes promotion-rules, lesson-completion-evaluator, next-skill-engine.
- **Typecheck:** `npm run typecheck`
- **E2E:** Set `TEST_LEARNER_EMAIL` and `TEST_LEARNER_PASSWORD`, then `npm run test:e2e`. The lesson flow spec now:
  1. Logs in, starts Ace Lesson Math, goes through focus → concept → … → guided try → independent try → celebration → Done.
  2. After redirect to arcade, GETs `/api/v2/me` and `/api/v2/parent/closed-loop?learnerId=<id>&domain=math` and asserts `latest_lesson_decision` is defined and `mastery_by_skill` is an array.

## 4. Exact description of the closed loop now working

1. **Lesson completion**
   - When the learner clicks "Done" on the celebration scene, the client sends `POST /api/v2/instruction/episode/:episodeId/complete` with `guided_try_success`, `independent_try_success`, `hint_usage_count`, `completed_at`.

2. **Evaluation**
   - Server loads episode, plan, current mastery, domain skills, due reviews.
   - `evaluateLessonCompletion()` runs:
     - Computes mastery delta from guided + independent tries (two Bayesian updates).
     - Runs `computePromotionDecision()` → **advance | hold | review | reteach**.
     - Determines `next_skill_candidate` (scheduled review, next in curriculum, or reinforce current).
     - Returns `next_review_at` and review recommendation.

3. **Persistence**
   - **skill_mastery:** Upserted with new `mastery_probability`, `confidence_score`, `attempts_count`, `last_attempt_at`, `next_review_at` (when review is recommended).
   - **review_schedule:** Upserted when `review_recommendation.schedule_review` is true.
   - **learner_lesson_history:** One row per completion with decision, mastery before/after, next_skill_id, next_skill_reason, next_skill_why.
   - **lesson_episodes:** `completion_status = 'completed'`, `promotion_decision` set.

4. **Next lesson**
   - When generating a new plan (`POST /api/v2/instruction/generate-plan`), if no `candidateSkillId` is provided, the server calls `getNextBestSkillForLearner(learnerId, domain)`:
     - First chooses a **due review** skill (from `review_schedule`) if any.
     - Otherwise uses the **last lesson’s next_skill_candidate** (from history) if available.
     - Otherwise picks the **first eligible skill** in curriculum order (prerequisite-aware).
   - That candidate is passed into `loadInstructionEngineInput` and the deterministic builder (or OpenAI) produces a plan for that skill.

5. **Parent visibility**
   - `GET /api/v2/parent/closed-loop?learnerId=&domain=math` returns:
     - `mastery_by_skill` (skill_id, skill_name, mastery_probability, confidence_score, attempts_count, next_review_at)
     - `latest_lesson_decision` (episode_id, domain, skill_name, promotion_decision, mastery_before/after, next_skill_reason, created_at)
     - `next_planned_skill` (from `getNextBestSkillForLearner`)
     - `recent_misconceptions`, `scheduled_reviews`

So: **complete lesson → evaluate → update mastery & review_schedule & history → next plan uses that state → parent can inspect it.**

## 5. What still remains before Phase 4

- **Spaced-check count:** `spaced_check_count` on `skill_mastery` is not yet incremented when a review is done (and correct); the promotion rule in the mastery engine (2 spaced checks for promotion) is not wired into the lesson path.
- **Misconception persistence:** `misconception_updates` from the evaluator are not yet written to `attempt_misconceptions` or `misconceptions`; they are only in the outcome summary.
- **Parent UI:** Only the API is provided; no dashboard or page yet that renders closed-loop view (could be a simple table on the existing parent area).
- **Configurable thresholds:** Promotion rules use `DEFAULT_PROMOTION_CONFIG`; no DB or env-based config yet.
- **Non-math domains:** Next-skill and lesson completion are built for math; other domains would need curriculum ordering and skill resolution.
- **Games / Phase 4:** Not started; closed-loop is the long-term learning brain only.

---

**Deployment note:** This phase touches **migrations**, **session/lesson logic**, and **mastery/review**. Use a **preview branch** (e.g. `preview/phase3b-closed-loop`), run migrations, verify E2E and parent API, then merge to `main`.
