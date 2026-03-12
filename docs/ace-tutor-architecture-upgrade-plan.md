# ACE Tutor Architecture Upgrade — Revised Implementation Plan

**Goal:** Dan and Lila as true ACE-powered tutors: conversational first, lesson helper second.  
**Scope:** Preview-first only; no merge to main until verified.

---

## 1. Revised Implementation Plan

### Problem
The girls are not getting ACE. Dan/Lila still behave like narrow lesson responders and fall back into explanation blocks for conversational turns (“thank you”, “my name is Elle”), because:
- Every reply is forced into `explanation + hints + example`.
- The model is prompted to return that shape, so it tends to fill all three.
- Conversation history is secondary to a single “context block”; the tutor doesn’t reply in true continuity.

### Solution (architecture)

| Layer | Description |
|-------|-------------|
| **ACE core** | Single conversational tutor prompt: warm, intent-aware, child-safe, avoids canned blocks. |
| **Personality** | Dan = ACE tuned for Liv (smart, playful, confident, 7yo). Lila = ACE tuned for Elle (gentle, simple, warm, 5yo). |
| **Response model** | Primary field is `message`. Optional `hints` and `example` only when the turn is hint/explanation. Mode signals intent (social, greeting, hint, etc.). |
| **Conversation state** | Transcript history is the main context: recent exchange in order; tutor replies in continuity (OpenAI conversation-style messages). |
| **Transcript logging** | Unchanged: every learner and tutor turn stored for parent review. |

### Implementation order

1. **API response shape** — Change to `message` + `mode` + optional `hints`/`example` + `shouldSpeak`. Parse and validate; keep backward-compatible transcript content (one string per tutor turn).
2. **ACE core prompt** — One shared prompt: conversational, social-first, intent-aware, child-safe. Then append Dan vs Lila personality lines.
3. **Conversation context** — Build OpenAI messages as: `[system], ...history (user/assistant), user(current message + optional lesson context)]`. No single giant “context block” that overrides the dialogue.
4. **Short-circuits** — Keep deterministic short-circuits for gratitude/greeting/off_topic; return new shape (`message`, `mode`, empty hints/example, `shouldSpeak: true`).
5. **Model instruction** — Ask for the new JSON shape; emphasize: for social/greeting/redirect/follow_up, reply with `message` only; hints/example only for hint/explanation.
6. **Client** — Consume `message` as primary text; append hints/example only if present; use `shouldSpeak` for TTS (e.g. speak `message` only for social, or full text when hint/explanation).
7. **Transcript** — Continue writing one row per tutor turn; content = full reply string (message + optional hints/example) so parent sees the same as the learner. No schema change.

---

## 2. Exact API Response Shape

**Primary (required):**

- **`message`** (string) — The main conversational reply. Always present. This is what the tutor “says” first.

**Mode and optional content:**

- **`mode`** (string) — One of: `social` | `greeting` | `hint` | `explanation` | `encouragement` | `redirect` | `follow_up`.
- **`hints`** (string[], optional) — Only when the reply is hint/explanation; otherwise `[]` or omit.
- **`example`** (string, optional) — Only when useful; otherwise `""` or omit.
- **`shouldSpeak`** (boolean) — Whether the client should run TTS for this reply (default `true`).

**Stability / debug (unchanged):**

- **`fallback`** (boolean, optional) — True when a fallback or short-circuit was used.
- **`_debug`** (string, optional) — Reason code when fallback (e.g. `intent_gratitude`).

**Example responses:**

```json
{ "message": "You're welcome, Elle. I'm happy to help. Want to try it together?", "mode": "social", "hints": [], "example": "", "shouldSpeak": true }
```

```json
{ "message": "Hi Elle! I'm Lila. Ask me if you want a hint or help with the question.", "mode": "greeting", "hints": [], "example": "", "shouldSpeak": true }
```

```json
{ "message": "Let's try counting the groups first. How many groups of 2 do you see?", "mode": "hint", "hints": ["Count by twos.", "Then add them."], "example": "", "shouldSpeak": true }
```

**Backward compatibility:** The API will **no longer** return `explanation` as the primary field. Clients must use `message`. Old clients that only read `explanation` will need to be updated (AceChatPanel is the only consumer).

---

## 3. Exact Files to Change

| File | Change |
|------|--------|
| **`src/app/api/v2/ace/help/route.ts`** | (1) New type `AceHelpResponse` with `message`, `mode`, `hints?`, `example?`, `shouldSpeak`. (2) New parse function for that shape; validate `message` and `mode`. (3) Single ACE core prompt string + Dan/Lila personality append. (4) Build OpenAI messages: system + history (as user/assistant) + user message (learner’s latest + optional short lesson context). (5) Short-circuit responses return new shape. (6) Fallbacks and `fallbackAceHelp` return new shape (map explanation → message). (7) `formatTutorContent` builds one string from `message` + hints + example for transcript. (8) Keep all `respondWithTranscript` and transcript metadata as today. |
| **`src/app/v2/learn/session/[sessionId]/AceChatPanel.tsx`** | (1) Parse response: prefer `message`; treat `explanation` as fallback for one deploy transition if desired. (2) Display: primary text = `message`; append hints/example only if present and non-empty. (3) TTS: use `shouldSpeak`; speak `message` only for social/greeting/redirect, or full composed text for hint/explanation (or always full text for simplicity). (4) No change to learner message sending, history, or voice. |

**No changes:**

- Transcript table and RLS (no schema change).
- `src/lib/db/tutorTranscript.ts` — unchanged; still receives one `content` string per tutor turn.
- `src/app/api/v2/transcript/route.ts` — unchanged.
- `src/app/v2/parent/transcript/page.tsx` — unchanged.
- Session flow, learner slug, input source — unchanged.

---

## 4. What Stays Compatible With Current Transcript Logging

- **Table `tutor_transcript`** — No change. Still one row per message; `content` is text; `role` learner/tutor; `metadata` optional.
- **Insert contract** — `insertTutorTranscriptRow(supabase, { learnerId, sessionId, helperName, role, content, inputSource?, metadata? })`. We still pass one `content` string per tutor reply.
- **Content format** — Server builds that string from the new shape: `message` + (if hints/example present) `"\n\nHints: ..."` and `"\n\nExample: ..."`. So the stored transcript is the full reply the learner sees. Parent report and export remain unchanged.
- **API route** — Still POST `/api/v2/ace/help`; same auth, same session/exercise validation; same learner + tutor inserts. Only the **response body** shape changes from `{ explanation, hints, example }` to `{ message, mode, hints?, example?, shouldSpeak }`.

---

## 5. Preview Branch Strategy

- **Branch:** Keep using **`preview/ace-tutor-transcript`** (or create **`preview/ace-tutor-v2`** if you want a separate branch for this architecture change).
- **Workflow:** Implement on the chosen preview branch → push → deploy preview on Vercel → run test prompts (below) → no merge to main until the girls clearly get ACE through Dan/Lila.
- **Migration:** No DB migration for this change. Only code and prompt changes.

**Recommendation:** Use **`preview/ace-tutor-transcript`** and add this architecture upgrade there so one preview has both transcript logging and the new conversational model. If you prefer a separate branch name (e.g. `preview/ace-conversational`), create it from `preview/ace-tutor-transcript` and push the new changes there.

---

## 6. Exact Test Prompts to Confirm the Girls Are Talking to ACE

Use the **preview** deployment; test as **Liv** (Dan) and **Elle** (Lila) in separate flows.

**1. Gratitude (no lesson block)**  
- **Say:** “Thank you Lila” or “Thanks Dan”  
- **Expect:** One short, warm social reply (e.g. “You’re welcome, Elle. I’m happy to help.”). **No** repeated explanation, no hints list, no example block.

**2. Greeting**  
- **Say:** “Hi” or “Hey Lila” or “Hello Dan”  
- **Expect:** A short greeting back. **No** lesson explanation or hints.

**3. Self-introduction**  
- **Say:** “My name is Elle” or “I’m Liv”  
- **Expect:** Warm acknowledgment of the name (e.g. “Nice to meet you, Elle!”). **No** lesson block.

**4. Confusion**  
- **Say:** “I’m confused” or “I don’t get it”  
- **Expect:** A simpler, shorter explanation or one clear next step. **No** long repeated lesson block.

**5. Follow-up (continuation)**  
- **Say:** After a prior tutor reply, “What do I do next?” or “And then?”  
- **Expect:** Answer that continues from the previous reply. **No** restart of the full explanation.

**6. Help / hint**  
- **Say:** “Can you help me?” or “Give me a hint”  
- **Expect:** A helpful hint or short explanation; may include hints/example in the response. Message should feel conversational, not a canned block.

**7. Off-topic**  
- **Say:** “How old are you?” or “What’s your favorite color?”  
- **Expect:** A short, safe, playful redirect (e.g. “I’m a robot who loves helping with this question! Let’s focus on that.”). **No** long lesson explanation.

**Pass criteria:** For 1–3 and 7, the reply is **short and social/redirect-only**. For 4–6, the tutor responds in **continuity** and feels like a **conversational partner**; no robotic repetition of a full lesson block. Transcript logging still records every turn; parent can confirm in Tutor transcript.

---

## 7. Voice and Future Real-Time Voice

- **Current:** Text + voice (browser speech recognition → send transcript; TTS for tutor reply) — keep as is.
- **Architecture:** Response shape includes `shouldSpeak` so the client can decide what to speak (e.g. message-only for social, full for hint/explanation). Conversation is message-based; a future real-time voice layer can replace “send transcript → get one reply” with streaming or turn-by-turn voice without changing the core tutor contract (message + mode + optional hints/example).

---

## 8. Summary

| Item | Content |
|------|--------|
| **Response model** | `message` (required), `mode`, `hints?`, `example?`, `shouldSpeak` |
| **ACE core** | One conversational, social-first, intent-aware prompt; Dan/Lila personality appended |
| **Context** | Real conversation state: system + history (user/assistant) + latest user message (+ optional lesson context) |
| **Transcript** | Unchanged: one row per turn; content = full reply string from new shape |
| **Files** | `route.ts` (prompt, parse, response shape, transcript content builder); `AceChatPanel.tsx` (consume message, optional hints/example, shouldSpeak) |
| **Preview** | Same branch as transcript (`preview/ace-tutor-transcript`) or dedicated branch; no merge until verified |
| **Test** | Seven prompts above; pass = social-first, no repeated lesson blocks, continuity on follow-up |
