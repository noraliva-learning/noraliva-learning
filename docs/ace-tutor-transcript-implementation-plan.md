# ACE-Powered Tutor Architecture & Transcript Logging — Implementation Plan

## Goal

- **ACE** = single intelligence layer; **Dan** = ACE tuned for Liv; **Lila** = ACE tuned for Elle.
- Full **transcript logging** of every tutor interaction for parent review and reporting.
- **Preview-first**; no merge to main until verified.

---

## 1. Implementation Plan (High Level)

| Phase | Description |
|-------|-------------|
| **A. Schema** | Add `tutor_transcript` table + RLS; no changes to existing tables. |
| **B. Tutor context** | Enrich ACE help route with learner name/slug, helper, age/level, domain, skill, question, learner answer, recent lesson result (optional), rolling history. Refine system prompts so Dan/Lila are clearly “ACE tuned for Liv/Elle.” |
| **C. Transcript logging** | On every learner message and every tutor reply (including short-circuits), insert one row per message into `tutor_transcript`. Client sends `inputSource: 'text' | 'voice'` so we can store it. |
| **D. Transcript API** | New route(s) to fetch transcript history: filter by learner (parent: children only), date range; return chronological list. |
| **E. Parent reporting v1** | Data model + API first; optional simple report page (list + date/learner filters). Export-ready JSON/CSV if straightforward. |

---

## 2. Exact Schema Changes

### New migration: `supabase/migrations/00012_tutor_transcript.sql`

- **Table: `tutor_transcript`**
  - `id` uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - `learner_id` uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  - `session_id` uuid REFERENCES learning_sessions(id) ON DELETE SET NULL
  - `created_at` timestamptz NOT NULL DEFAULT now()
  - `helper_name` text NOT NULL  -- 'Dan' | 'Lila' | 'Ace'
  - `role` text NOT NULL CHECK (role IN ('learner', 'tutor', 'system'))
  - `content` text NOT NULL
  - `input_source` text CHECK (input_source IN ('text', 'voice'))  -- only for role = 'learner'
  - `metadata` jsonb DEFAULT '{}'  -- optional: domain, skill_id, exercise_id, current_question, learner_answer_at_time

- **Indexes**
  - `idx_tutor_transcript_learner_id` ON tutor_transcript(learner_id)
  - `idx_tutor_transcript_created_at` ON tutor_transcript(created_at)
  - `idx_tutor_transcript_session_id` ON tutor_transcript(session_id)  -- for per-session views

- **RLS**
  - Enable RLS on `tutor_transcript`.
  - **SELECT**: `can_access_learner(learner_id)` — learner sees own, parent sees children’s.
  - **INSERT**: `learner_id = auth.uid()` — only the learner’s own session can add rows (API runs as learner when they use the chat).

No other schema changes. Existing `chat_logs` remains unchanged; we do not use it for tutor transcript (clear separation).

---

## 3. Exact Files to Change / Add

| File | Action |
|------|--------|
| `supabase/migrations/00012_tutor_transcript.sql` | **Create** — table, indexes, RLS. |
| `src/app/api/v2/ace/help/route.ts` | **Change** — Accept optional `inputSource`, `learnerSlug`. Enrich context block with learner name, slug, helper, age/level (from profile), domain, skill, question, learner answer, optional “recent lesson result” (e.g. last attempt correct/incorrect for session). After sending learner message to model (or short-circuit), insert learner row into `tutor_transcript`. After generating (or short-circuit) tutor reply, insert tutor row. Use shared helper `insertTutorTranscriptRow(supabase, { learnerId, sessionId, helperName, role, content, inputSource?, metadata? })`. |
| `src/app/v2/learn/session/[sessionId]/AceChatPanel.tsx` | **Change** — Send `learnerSlug` and `inputSource: 'text' | 'voice'` in the POST body for each request (voice when sent from mic, text when typed). |
| `src/lib/db/tutorTranscript.ts` (or `src/app/api/v2/ace/help/transcript.ts`) | **Create** — Helper to insert one transcript row; type for metadata. |
| `src/app/api/v2/parent/transcript/route.ts` (or `src/app/api/v2/transcript/route.ts`) | **Create** — GET with query params: `learnerId` (optional, for parent: one of their children’s ids), `from`, `to` (ISO date or datetime). Auth: parent gets only children; learner gets only self. Return chronological array of transcript entries. |
| `src/app/v2/parent/transcript/page.tsx` (optional for v1) | **Create** — Simple parent-only page: choose child (or “all”), date range, display chronological transcript list; optional “Export JSON” / “Export CSV” if easy. If scope is too large for this pass, ship API only and add page in a follow-up. |

**Optional / minor**
- `src/lib/supabase/types.ts` — Regenerate or extend with `tutor_transcript` row type if using typed client.

**Implementation status:** Migration, `tutorTranscript.ts`, types, ACE route (context + transcript inserts), AceChatPanel + SessionFlow (`learnerSlug`, `inputSource`), `GET /api/v2/transcript`, `/v2/parent/transcript` page with filters and Export JSON, and parent dashboard link are implemented.

---

## 4. Preview Branch Name

- **Branch:** `preview/ace-tutor-transcript`
- Do not merge to `main` until parent verification and product sign-off.

---

## 5. What Will Be Included in v1 of Transcript Reporting

- **Stored data:** Every learner and tutor message in the ACE chat, with timestamp, helper name, role, content, input source (text/voice), and optional metadata (domain, skill_id, exercise_id, current_question, learner_answer at time of message).
- **API:** At least one route (e.g. `GET /api/v2/parent/transcript` or `GET /api/v2/transcript`) that:
  - Returns transcript entries for the authenticated user (parent: their children only; learner: self only).
  - Supports filter by learner (parent selects which child) and date range.
  - Returns chronological, export-friendly structure (e.g. array of `{ id, learner_id, session_id, created_at, helper_name, role, content, input_source, metadata }`).
- **Export:** JSON response is export-ready; optional CSV download in the UI if simple to add in v1.
- **UI (optional in v1):** A simple parent-facing report page that lists transcript entries with filters (learner, date range) and optionally “Export JSON/CSV”. If time-boxed, v1 can be API-only and the page can follow in a quick next PR.

---

## 6. What the Parent Will Be Able to Review After This Pass

- **Chronological transcript** of all tutor interactions (Dan/Lila) for Liv and/or Elle.
- **Per message:** who spoke (learner vs tutor), when, which helper (Dan/Lila), full content, whether the learner was typing or using voice.
- **Context (in metadata):** domain, skill, exercise, current question, learner’s answer at that moment — so the parent can see what the child was working on when they asked for help.
- **Filtering** by child and by date range.
- **Export** of the same data (JSON at minimum; CSV if implemented) for offline review or record-keeping.

---

## 7. Safety (Recap)

- No personal questions; no school/location/address.
- Kid-safe language; off-topic handled with warm redirect.
- No exposure of system prompts or internal data in transcript (only role + content + metadata).
- Parent can review all transcript data for their children via RLS and the new API/page.

---

## 8. Order of Implementation

1. Create migration `00012_tutor_transcript.sql` and apply (or document for apply on preview). **Done.**
2. Add `tutorTranscript` helper and types. **Done.**
3. Update ACE help route: enrich context, add transcript inserts (learner + tutor) for every turn, including short-circuits; accept `inputSource` and `learnerSlug`. **Done.**
4. Update AceChatPanel to send `learnerSlug` and `inputSource`. **Done.**
5. Add transcript API route with auth and filters. **Done.** (`GET /api/v2/transcript`)
6. (Optional) Add parent transcript report page with filters and export. **Done.** (`/v2/parent/transcript`)
7. Run lint/build/tests; push to `preview/ace-tutor-transcript`; provide preview URL and test steps.
