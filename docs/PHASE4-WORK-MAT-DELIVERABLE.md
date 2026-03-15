# Phase 4 — Work Mat Canvas — Deliverable

## 1. Updated file tree (new/changed)

```
src/
├── lib/
│   ├── workmat/
│   │   ├── workmat-schema.ts           NEW   Zod schemas: SceneWorkmatConfig, Stroke, PlacedObject, Connection, WorkmatState, WorkmatValidationResult, modalities, demo overlays
│   │   ├── workmat-schema.test.ts      NEW   Unit tests for schema parsing
│   │   ├── workmat-validation.ts       (existing) pointInZone, strokeOverlapsZone, objectInZone, traceCompletionPercent, countMarksInZone, connectionMatch, runValidation
│   │   └── workmat-validation.test.ts  NEW   Unit tests for validation helpers and runValidation
│   ├── instruction/
│   │   ├── scene-schema.ts             CHANGED Base scene has optional workmat: sceneWorkmatConfigSchema
│   │   ├── scene-schema.test.ts       CHANGED Test manipulative with workmat config
│   │   ├── completion-schemas.ts       CHANGED workmatOutputSchema, lessonCompletionInputSchema.workmat_output
│   │   └── deterministic-builder.ts  CHANGED Manipulative scene includes workmat (workmat_enabled, workmat_mode: free_sketch, workmat_modality: build_array)
│   └── db/
│       ├── lessonEpisode.ts           CHANGED LessonEpisodeRow.workmat_output; getLessonEpisode returns it
│       └── lessonCompletion.ts       CHANGED updateLessonEpisodeOnComplete accepts workmatOutput, writes workmat_output
├── components/
│   ├── workmat/
│   │   ├── index.ts                   NEW   Export WorkMat, WorkMatToolbar, WorkMatCanvas, DemoOverlay, WorkmatState
│   │   ├── WorkMat.tsx                NEW   Container: dynamic WorkMatCanvas (ssr: false), WorkMatToolbar, tool/clear state, onStateChange
│   │   ├── WorkMatToolbar.tsx         (existing) Pen, highlighter, eraser, pointer, line, circle, clear
│   │   ├── WorkMatCanvas.tsx          (existing) Konva Stage/Layer: background, zones, trace guides, draggables, strokes, connections, circle preview; DemoOverlay layer
│   │   └── DemoOverlay.tsx            NEW   Animated trace path, highlight zone, ghost stroke (demo_overlays from config)
│   └── lesson-scenes/
│       ├── MotionLessonRenderer.tsx   CHANGED lastWorkmatState, lastWorkmatValidation; pass workmat + callbacks to Manipulative/Guided/Independent; LessonCompletionResult.workmatOutput
│       ├── ManipulativeScene.tsx     CHANGED workmat, onWorkmatStateChange, onWorkmatValidationResult; render WorkMat when workmat_enabled; run validation on Continue
│       ├── GuidedTryScene.tsx         CHANGED Optional workmat, Work Mat UI, validation on submit
│       └── IndependentTryScene.tsx    CHANGED Optional workmat, Work Mat UI, validation on submit
├── app/
│   ├── api/v2/instruction/episode/[episodeId]/
│   │   ├── route.ts                   CHANGED GET response includes workmatOutput when present
│   │   └── complete/route.ts          CHANGED POST body workmat_output; pass to updateLessonEpisodeOnComplete
│   └── v2/learn/lesson/[episodeId]/
│       └── LessonPageClient.tsx      CHANGED handleComplete sends workmat_output when result.workmatOutput present
supabase/migrations/
└── 00015_workmat_output.sql          NEW   lesson_episodes.workmat_output jsonb
e2e/
└── workmat-lesson.spec.ts             NEW   E2E: login → Ace Lesson Math → reach manipulative (Work Mat) → draw → Next → complete lesson
docs/
└── PHASE4-WORK-MAT-DELIVERABLE.md    NEW   This file
```

## 2. All new/changed files

**New**

- `src/lib/workmat/workmat-schema.test.ts`
- `src/lib/workmat/workmat-validation.test.ts`
- `src/components/workmat/index.ts`
- `src/components/workmat/WorkMat.tsx`
- `src/components/workmat/DemoOverlay.tsx`
- `supabase/migrations/00015_workmat_output.sql`
- `e2e/workmat-lesson.spec.ts`
- `docs/PHASE4-WORK-MAT-DELIVERABLE.md`

**Changed**

- `src/lib/instruction/scene-schema.ts` — optional `workmat` on base scene
- `src/lib/instruction/scene-schema.test.ts` — manipulative with workmat test
- `src/lib/instruction/completion-schemas.ts` — `workmatOutputSchema`, `workmat_output` on completion input
- `src/lib/instruction/deterministic-builder.ts` — workmat on manipulative scene
- `src/lib/db/lessonEpisode.ts` — `workmat_output` on row type
- `src/lib/db/lessonCompletion.ts` — `updateLessonEpisodeOnComplete(..., workmatOutput?)`
- `src/components/workmat/WorkMatCanvas.tsx` — useEffect for state sync, DemoOverlay layer, Konva type fixes
- `src/components/lesson-scenes/MotionLessonRenderer.tsx` — workmat state/callbacks, workmatOutput in completion result
- `src/components/lesson-scenes/ManipulativeScene.tsx` — workmat config, WorkMat, validation on Continue
- `src/components/lesson-scenes/GuidedTryScene.tsx` — optional workmat, WorkMat, validation on submit
- `src/components/lesson-scenes/IndependentTryScene.tsx` — optional workmat, WorkMat, validation on submit
- `src/app/api/v2/instruction/episode/[episodeId]/route.ts` — GET returns `workmatOutput`
- `src/app/api/v2/instruction/episode/[episodeId]/complete/route.ts` — POST accepts and persists `workmat_output`
- `src/app/v2/learn/lesson/[episodeId]/LessonPageClient.tsx` — completion body includes `workmat_output`

## 3. Migrations

- **`00015_workmat_output.sql`**: Adds `workmat_output jsonb DEFAULT NULL` to `lesson_episodes`. Stores `{ workmat_used, state?, validation_result? }` when a lesson used the Work Mat.

**Apply:** `npx supabase db push` or run the migration in your Supabase project.

## 4. Setup steps

1. **Dependencies**  
   - `konva` and `react-konva` are in `package.json`. Run `npm install` if not already done.

2. **Database**  
   - Apply migration `00015_workmat_output.sql` so `lesson_episodes.workmat_output` exists.

3. **No env changes**  
   - Work Mat uses the existing lesson/episode and auth flow.

## 5. Test steps

- **Unit tests**
  - `npm run test -- --run src/lib/workmat src/lib/instruction/scene-schema.test.ts`  
  - Covers workmat schema parsing, validation helpers, `runValidation` by type, and manipulative scene with workmat.

- **Typecheck**
  - `npm run typecheck`

- **Lint**
  - `npm run lint`

- **Build**
  - `npm run build`

- **E2E (Work Mat lesson)**
  - Set `TEST_LEARNER_EMAIL` and `TEST_LEARNER_PASSWORD`.
  - `npm run test:e2e -- e2e/workmat-lesson.spec.ts`  
  - Logs in → Ace Lesson Math → advances to “Move the pieces” (manipulative with Work Mat) → asserts Work Mat container and toolbar → optional draw on canvas → Next → completes lesson (guided/independent try, celebration, Done) → asserts redirect to arcade.

## 6. Exact description of what Work Mat can do now

- **Core**
  - Reusable Work Mat canvas (react-konva) inside the current lesson episode flow.
  - Works with touch and pointer (Apple Pencil supported by browser/Konva; no extra config).
  - Embeddable in **manipulative**, **guided try**, and **independent try** scenes when `workmat.workmat_enabled` is true.
  - State (strokes, placed objects, connections) is reported via `onStateChange` and persisted on lesson completion when the lesson used the Work Mat.

- **Modes**
  - **Structured Worksheet:** Background, target zones (dashed), trace guides, draggable objects, answer areas; validation can use zones, trace completion, marks in region, object placement, connections.
  - **Free Sketch:** Blank or lightly guided canvas; child can draw, circle, underline, connect, mark.

- **Tools**
  - Pen, highlighter, eraser, pointer (no draw), line (two-point segment), circle (center + radius), clear canvas. Child-friendly toolbar.

- **Input**
  - Single pointer path: pencil/touch work; low-friction drawing and responsive ink via Konva. Palm rejection is not implemented; rely on device/browser where available.

- **Lesson integration**
  - Scene JSON can set `workmat_enabled`, `workmat_mode`, `workmat_modality`, `background_asset`, `target_zones`, `trace_paths`, `draggable_objects`, `expected_marks`, `validation_type`, `demo_overlays`.
  - Manipulative scene from the deterministic builder has Work Mat enabled by default (math, `build_array` modality).

- **Ace-aware**
  - Modalities in schema: `draw_groups`, `trace_number`, `circle_answer`, `connect_matches`, `underline_word_part`, `build_array`, `sketch_solution`. Deterministic builder sets `workmat_modality: 'build_array'` for the manipulative scene.

- **Validation**
  - `target_hit` / `zone_overlap`: stroke overlaps target zone(s).
  - `object_in_zone`: placed draggable(s) in correct zone(s).
  - `trace_completion`: stroke overlap with trace path ≥ 70%.
  - `marks_in_region`: min count of marks (strokes) in a zone.
  - `connection_match`: at least one connection.
  - Default: valid if any strokes or placed objects. No handwriting OCR.

- **Demonstration overlay**
  - `demo_overlays` in config: animated trace path, highlight zone, ghost stroke. Rendered when `showDemoOverlay` is true (e.g. when scene has `demo_overlays`).

- **Persistence**
  - On lesson complete, client sends `workmat_output: { workmat_used, state?, validation_result? }` when Work Mat was used.
  - Server stores it in `lesson_episodes.workmat_output`.

- **Parent / debug visibility**
  - GET `/api/v2/instruction/episode/:episodeId` includes `workmatOutput` when the episode has saved workmat output (whether Work Mat was used, validation result, saved state reference).

## 7. What remains after Phase 4

- **Handwriting OCR** — Not in scope; validation is zone/trace/marks/placement/connection only.
- **All domains** — Work Mat is math-first; other domains can use the same schema when needed.
- **Dashboard polish** — No parent dashboard UI for Work Mat output; only API visibility (`workmatOutput` on episode GET).
- **Games** — No detour into games; Work Mat is for teaching and worked examples.
- **Palm rejection** — Not implemented; rely on platform/browser.
- **Richer demo overlays** — Placement/connection hints are in schema but only trace_path, highlight_zone, ghost_stroke are rendered in DemoOverlay; could add placement/connection visuals later.
- **Background image** — `background_asset` is in schema but canvas currently uses a solid background; can be extended to load an image URL.
- **Per-scene workmat in sequence** — Only the last workmat state from the lesson is sent on completion; multiple scenes with Work Mat could be extended to collect per-scene output if needed.
