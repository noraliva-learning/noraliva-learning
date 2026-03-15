# Phase 5 — Parent Insight + Learning Signal Layer — Deliverable

## 1. Updated file tree (new/changed)

```
src/
├── lib/
│   ├── signals/
│   │   ├── learning-signals-schema.ts       NEW   Zod schema: LearningSignals, SceneSignalOutcome
│   │   ├── learning-signals-schema.test.ts NEW   Unit tests
│   │   ├── insight-engine.ts               NEW   deriveLearnerInsights(), confidence/guessing heuristics
│   │   └── insight-engine.test.ts          NEW   Unit tests for derivation and heuristics
│   ├── instruction/
│   │   ├── completion-schemas.ts           CHANGED learning_signals on lessonCompletionInputSchema
│   │   ├── engine-types.ts                 CHANGED LearnerInsightSummary, learner_insights on input
│   │   ├── load-context.ts                 CHANGED Load learner_insights from DB, add to engine input
│   │   ├── deterministic-builder.ts        CHANGED applyInsightsToDefaults(), use insights for support_level/modality
│   │   └── deterministic-builder.test.ts   CHANGED Tests for insight-driven support_level and modality
│   ├── db/
│   │   ├── lessonSignals.ts                 NEW   insertLessonSignals()
│   │   ├── learnerInsights.ts              NEW   getLearnerInsights(), upsertLearnerInsight()
│   │   └── getClosedLoopView.ts            CHANGED learner_insights, recent_episodes_for_review
│   └── app/
│       └── api/v2/instruction/episode/[episodeId]/
│           └── complete/route.ts           CHANGED Persist learning_signals, derive and upsert insights
├── components/lesson-scenes/
│   ├── MotionLessonRenderer.tsx            CHANGED narrationReplayCount, guided/independent signals, learningSignals in result
│   ├── GuidedTryScene.tsx                  CHANGED onGuidedSubmit, onNarrationReplay, latency + answerChanged tracking
│   ├── IndependentTryScene.tsx            CHANGED onIndependentSubmit, onNarrationReplay, latency + answerChanged
│   ├── AudioReplayButton.tsx               CHANGED onReplay callback
│   ├── FocusScene.tsx                      CHANGED onNarrationReplay
│   ├── ConceptCardScene.tsx                CHANGED onNarrationReplay
│   ├── WorkedExampleScene.tsx              CHANGED onNarrationReplay
│   ├── ManipulativeScene.tsx              CHANGED onNarrationReplay
│   ├── HintOverlay.tsx                     CHANGED onNarrationReplay
│   └── CelebrationScene.tsx                CHANGED onNarrationReplay
├── app/
│   ├── v2/learn/lesson/[episodeId]/
│   │   └── LessonPageClient.tsx            CHANGED Send learning_signals in complete body
│   ├── v2/parent/
│   │   ├── page.tsx                        CHANGED Link to Learning insight
│   │   └── insight/
│   │       ├── page.tsx                    NEW   Server: get children, render ParentInsightView
│   │       └── ParentInsightView.tsx       NEW   Client: closed-loop fetch, mastery, insights, recent lessons
supabase/migrations/
├── 00016_lesson_signals.sql                NEW   lesson_signals table
├── 00017_learner_insights.sql              NEW   learner_insights table
└── 00018_lesson_episodes_parent_select.sql NEW   Policy for parent to SELECT lesson_episodes
e2e/
└── parent-insight-signals.spec.ts          NEW   E2E: complete lesson, closed-loop has insights; insight page loads
docs/
└── PHASE5-PARENT-INSIGHT-SIGNALS-DELIVERABLE.md NEW This file
```

## 2. All changed files

**New:**  
`src/lib/signals/learning-signals-schema.ts`, `learning-signals-schema.test.ts`, `insight-engine.ts`, `insight-engine.test.ts`; `src/lib/db/lessonSignals.ts`, `learnerInsights.ts`; `src/app/v2/parent/insight/page.tsx`, `ParentInsightView.tsx`; `supabase/migrations/00016_lesson_signals.sql`, `00017_learner_insights.sql`, `00018_lesson_episodes_parent_select.sql`; `e2e/parent-insight-signals.spec.ts`; `docs/PHASE5-PARENT-INSIGHT-SIGNALS-DELIVERABLE.md`.

**Changed:**  
`src/lib/instruction/completion-schemas.ts`, `engine-types.ts`, `load-context.ts`, `deterministic-builder.ts`, `deterministic-builder.test.ts`; `src/lib/db/getClosedLoopView.ts`; `src/app/api/v2/instruction/episode/[episodeId]/complete/route.ts`; `src/components/lesson-scenes/MotionLessonRenderer.tsx`, `GuidedTryScene.tsx`, `IndependentTryScene.tsx`, `AudioReplayButton.tsx`, `FocusScene.tsx`, `ConceptCardScene.tsx`, `WorkedExampleScene.tsx`, `ManipulativeScene.tsx`, `HintOverlay.tsx`, `CelebrationScene.tsx`; `src/app/v2/learn/lesson/[episodeId]/LessonPageClient.tsx`; `src/app/v2/parent/page.tsx`.

## 3. Migrations

- **`00016_lesson_signals.sql`**  
  Creates `lesson_signals` (id, episode_id, learner_id, domain, skill_id, signals_json jsonb, created_at). Unique on episode_id. RLS: SELECT via `can_access_learner(learner_id)`, INSERT when learner_id = auth.uid().

- **`00017_learner_insights.sql`**  
  Creates `learner_insights` (id, learner_id, domain, insight_type, summary_plain_english, evidence_summary jsonb, version, created_at, updated_at) with UNIQUE(learner_id, domain, insight_type). RLS: SELECT via `can_access_learner(learner_id)`, INSERT/UPDATE when learner_id = auth.uid().

- **`00018_lesson_episodes_parent_select.sql`**  
  Adds policy so SELECT on `lesson_episodes` is allowed when `can_access_learner(learner_id)` (parent can read child episodes).

**Apply:** `npx supabase db push` or run these migrations in your Supabase project.

## 4. Setup steps

1. **Database**  
   Apply migrations 00016, 00017, 00018.

2. **No new env vars**  
   Uses existing auth and APIs.

3. **Parent insight**  
   From the parent dashboard, use the “Learning insight” link to open `/v2/parent/insight`. Choose a learner to view closed-loop data and insights.

## 5. Test steps

- **Unit**
  - `npm run test -- --run src/lib/signals src/lib/instruction/deterministic-builder.test.ts`  
  - Covers learning-signals schema, insight derivation, confidence/guessing heuristics, and Ace insight-driven support_level/modality.

- **Typecheck**
  - `npm run typecheck`

- **Lint**
  - `npm run lint`

- **E2E**
  - Set `TEST_LEARNER_EMAIL` and `TEST_LEARNER_PASSWORD`.
  - `npm run test:e2e -- e2e/parent-insight-signals.spec.ts`  
  - Completes a lesson, then checks that GET closed-loop returns `learner_insights` and `recent_episodes_for_review`, and that the parent insight page loads and shows the learner dropdown.

## 6. New signals captured

- **Per lesson (client + server):**  
  `response_latency_guided_ms`, `response_latency_independent_ms`, `hint_requests_total`, `answer_changed_before_submit_guided`, `answer_changed_before_submit_independent`, `guided_success`, `independent_success`, `workmat_used`, `workmat_validation_type`, `workmat_validation_valid`, `narration_replay_count`, `scene_replay_count`, `scene_outcomes` (array of scene_id, scene_type, success, hints_used, response_time_ms, answer_changed_before_submit, narration_replay_count). Server adds `review_success`, `first_pass_success` where applicable.

- **Stored in:**  
  `lesson_signals.signals_json` (one row per completed lesson).  
  Derived insights are stored in `learner_insights` (one row per learner/domain/insight_type, upserted on each lesson complete).

## 7. Parent insight UI

- **URL:** `/v2/parent/insight` (linked from parent dashboard as “Learning insight”).

- **Behavior:**  
  Learner dropdown (from profiles with parent_id = current user). For the selected learner, GET `/api/v2/parent/closed-loop?learnerId=&domain=math` and show:

  - **How [name] learns** — bullet list of `learner_insights[].summary_plain_english` (e.g. “Often answers quickly and correctly when supported”, “Succeeds with hints; may benefit from a bit more support”).
  - **Mastery (math)** — list of skills with mastery % and attempt count.
  - **Latest lesson** — skill name, promotion decision, mastery before/after.
  - **Next planned skill** — skill name, reason, why.
  - **Scheduled reviews** — skill and next review date.
  - **Recent misconceptions** — tags.
  - **Recent lessons** — last 5 episodes: skill name, completion status, promotion decision, Work Mat used and validation result, created_at.

- **Design:**  
  Simple sections in a single column, no extra reporting/export.

## 8. What remains after Phase 5

- **Domains** — Implemented for math; other domains can reuse signals/insights when added.
- **Games** — Not in scope.
- **OCR** — Not in scope.
- **Reporting/export** — No CSV/PDF; only in-app parent insight view and closed-loop API.
- **Richer scene_outcomes** — Only guided/independent latency and answer-changed are captured per try; more granular scene outcomes can be added later.
- **Insight versioning** — Insights are overwritten per type; no history of past summaries.
- **Ace OpenAI** — System prompt does not yet include learner_insights; only the deterministic builder uses them for support_level and modality.
