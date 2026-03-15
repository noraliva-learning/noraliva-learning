# Phase 3 — Ace Instruction Engine + Motion Lesson System — Deliverable

## 1. Updated file tree (new/changed)

```
src/
├── lib/
│   ├── instruction/
│   │   ├── scene-schema.ts          NEW   Lesson scene JSON schema (Zod)
│   │   ├── lesson-plan-schema.ts     NEW   Lesson plan output schema
│   │   ├── engine-types.ts          NEW   Engine input types
│   │   ├── learner-defaults.ts      NEW   Liv/Elle differentiation config
│   │   ├── deterministic-builder.ts NEW   Deterministic math lesson builder
│   │   ├── load-context.ts          NEW   Load learner context for engine
│   │   ├── instruction-engine.ts    NEW   Generate plan (OpenAI or fallback)
│   │   ├── scene-schema.test.ts     NEW   Scene validation tests
│   │   ├── lesson-plan-schema.test.ts NEW Lesson plan validation tests
│   │   └── deterministic-builder.test.ts NEW Deterministic builder tests
│   ├── speech/
│   │   ├── narration.ts             NEW   Narration layer (mute, replay, non-blocking)
│   │   └── narration.test.ts        NEW   Narration tests
│   └── db/
│       └── lessonEpisode.ts         NEW   Persist/load lesson episodes
├── components/
│   └── lesson-scenes/
│       ├── index.ts                 NEW   Exports
│       ├── AudioReplayButton.tsx     NEW
│       ├── FocusScene.tsx           NEW
│       ├── ConceptCardScene.tsx     NEW
│       ├── WorkedExampleScene.tsx    NEW
│       ├── ManipulativeScene.tsx     NEW
│       ├── GuidedTryScene.tsx        NEW
│       ├── IndependentTryScene.tsx   NEW
│       ├── HintOverlay.tsx          NEW
│       ├── CelebrationScene.tsx     NEW
│       └── MotionLessonRenderer.tsx NEW   Scene router + flow
├── app/
│   ├── api/v2/instruction/
│   │   ├── generate-plan/
│   │   │   └── route.ts             NEW   POST generate lesson plan + create episode
│   │   └── episode/[episodeId]/
│   │       └── route.ts             NEW   GET episode, PATCH progress
│   ├── v2/learn/lesson/[episodeId]/
│   │   ├── page.tsx                 NEW   Lesson episode page (server)
│   │   └── LessonPageClient.tsx     NEW   Client: renderer, mute, persist
│   └── v2/learners/[slug]/
│       └── page.tsx                 CHANGED  Added "Ace Lesson: Math" button
supabase/migrations/
└── 00013_lesson_episodes_phase3.sql  NEW   lesson_episodes table
e2e/
└── lesson-flow.spec.ts              NEW   E2E: login → Ace lesson → concept → guided → independent → celebration → done
```

## 2. Migrations

- **`00013_lesson_episodes_phase3.sql`**: Creates `lesson_episodes` with `id`, `learner_id`, `domain`, `skill`, `skill_id`, `lesson_plan_json`, `scene_sequence`, `generated_by`, `version`, `support_level`, `promotion_decision`, `completion_status`, `current_scene_index`, timestamps. RLS: learner select/insert/update own.

**Apply:** `supabase db push` or run the migration in your Supabase project.

## 3. Setup steps

1. **Apply migration**
   - From repo root: `npx supabase db push` (or apply `supabase/migrations/00013_lesson_episodes_phase3.sql` in dashboard).

2. **Optional: OpenAI for lesson generation**
   - Set `ACE_INSTRUCTION_ENGINE_OPENAI=true` and ensure `OPENAI_API_KEY` (and optionally `OPENAI_DAN_MODEL`) are set. If unset or OpenAI fails, the **deterministic builder** is used (math: counting, addition, subtraction, equal groups).

3. **Run app**
   - `npm run dev` — from learner dashboard (`/v2/learners/liv` or `/v2/learners/elle`), use **Ace Lesson: Math** to start an instruction-first lesson.

## 4. Test steps

- **Unit tests**
  - `npm run test` — runs all unit tests (instruction schemas, deterministic builder, narration, existing suites).
- **Typecheck**
  - `npm run typecheck`
- **E2E (lesson flow)**
  - Set `TEST_LEARNER_EMAIL` and `TEST_LEARNER_PASSWORD` in `.env.local`.
  - `npm run test:e2e` — includes `e2e/lesson-flow.spec.ts`: login → Ace Lesson: Math → concept scene → replay → guided try → independent try → celebration → redirect to arcade.

## 5. Summary of what is complete

- **Part 1 — Lesson architecture**
  - Lesson is a **teaching episode** with ordered scene sequence: focus → concept card → worked example → manipulative → guided try → independent try → hint step → celebration. Types and Zod schemas in `scene-schema.ts` and `lesson-plan-schema.ts`.

- **Part 2 — Ace Instruction Engine**
  - Server-side engine in `instruction-engine.ts` + `load-context.ts`. **Inputs:** learner id, domain, mastery, recent attempts, misconceptions, hint usage, review schedule, candidate skill. **Outputs:** structured lesson plan (target skill, why next, support level, modality, scene sequence, hint ladder, promotion criteria, fallback). OpenAI when `ACE_INSTRUCTION_ENGINE_OPENAI=true`, else **deterministic** math builder.

- **Part 3 — Lesson scene JSON schema**
  - Zod schemas for scene types: `focus_scene`, `concept_card`, `worked_example`, `manipulative`, `guided_try`, `independent_try`, `hint_step`, `celebration`. Fields: id, type, domain, skill, display_text, voiceover_text, animation_type, objects, interaction_type, expected_answer, validation_rule, hints, metadata. Strong validation via `validateScene` / `validateSceneSequence`.

- **Part 4 — Motion lesson renderer**
  - Reusable Framer Motion components: `FocusScene`, `ConceptCardScene`, `WorkedExampleScene`, `ManipulativeScene`, `GuidedTryScene`, `IndependentTryScene`, `HintOverlay`, `CelebrationScene`, `AudioReplayButton`. `MotionLessonRenderer` routes by `scene.type` and advances through the plan.

- **Part 5 — Audio / read-aloud**
  - `src/lib/speech/narration.ts`: `speakNarration`, `stopNarration`, `setNarrationMuted`, `isNarrationMuted`, `narrationSupported`. Browser speech synthesis MVP; does not block lesson on failure. Every scene supports `voiceover_text`, auto-play, replay button, mute toggle.

- **Part 6 — Liv / Elle differentiation**
  - `learner-defaults.ts`: Liv (more challenge, abstraction, faster progression, transfer prompts); Elle (shorter chunks, more visual, more read-aloud, more guided). Used by deterministic builder for `support_level` and `modality`.

- **Part 7 — Persistence**
  - `lesson_episodes` table stores `lesson_plan_json`, `scene_sequence`, `learner_id`, `domain`, `skill`, `generated_by`, `version`, `completion_status`, `current_scene_index`, timestamps. API: POST `/api/v2/instruction/generate-plan`, GET/PATCH `/api/v2/instruction/episode/[episodeId]`.

- **Part 8 — Initial domain: Math**
  - Deterministic builder supports **counting**, **addition**, **subtraction**, **equal groups** with full scene sequences and hints. Other domains not expanded; math is the template.

- **Part 9 — Testing**
  - Unit: scene schema, lesson plan schema, deterministic builder, narration (non-blocking, mute). E2E: learner opens lesson → concept scene → narration replay → guided try → independent try → celebration → completion and redirect.

## 6. What remains for next phase

- **Review scheduling decision** (e.g. write to `review_schedule` / mastery when lesson completes) — not wired; promotion_decision is in the plan only.
- **Wiring promotion/hold** into mastery engine (update `skill_mastery` / next skill choice based on `promotion_decision`).
- **More domains** (reading, writing, etc.) — extend deterministic builder or AI prompts.
- **Remotion-compatible scene design** — scenes are built for in-app motion only; no long-form video generation.
- **Optional:** Store attempt-level data (e.g. which scene, correct/incorrect) for analytics and next-plan inputs.
- **Optional:** Richer manipulatives (drag-and-drop, number line) in `ManipulativeScene` and schema.

---

**Deployment note (per workspace rules):** This phase touches **session/lesson logic**, **schema (migrations)**, and **auth/session**. Prefer a **preview branch** (e.g. `preview/phase3-instruction-engine`), deploy to Vercel preview, verify, then merge to `main`.
