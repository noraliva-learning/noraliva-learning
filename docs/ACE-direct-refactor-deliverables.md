# ACE-Direct Refactor — Deliverables

**Branch:** `preview/ace-tutor-transcript` (do not merge until tests pass and preview verified)

---

## 1. Exact files changed

| File | Change |
|------|--------|
| **`src/app/api/v2/ace/help/route.ts`** | ACE-direct refactor: 3 modes (social, guide, explain); intent `content_question`; context gating (social=none, guide=minimal, explain=full); Lila 2 sentences / Dan 3 sentences in prompt; `classifyIntent` moved to lib; `normalizeMode`; short-circuits and fallbacks use new modes. |
| **`src/lib/ace/intentRouter.ts`** | **New.** Deterministic intent router: `Intent` type and `classifyIntent(message)` in order greeting → gratitude → self_intro → meta_question → confusion → follow_up → help_request → content_question. |
| **`src/app/api/v2/ace/help/route.test.ts`** | **New.** Tests for the 5 prompts and intent order: "my name is Elle" → self_intro, "I'm confused" → confusion, "What do I do next?" → follow_up, "thank you Lila" → gratitude, "how old are you?" → meta_question; plus greeting, help_request, content_question. |

No changes to transcript schema, API response shape (still `message`, `mode`, `hints`, `example`, `shouldSpeak`), or AceChatPanel.

---

## 2. Exact root cause removed

**Cause:** Lesson context was sent to the model for every intent. The model was instructed to be “conversational” but still received full lesson context (domain, skill, current question, correct answer) for social and guide intents, so it kept collapsing into full explanation blocks.

**Fix:**

- **Intent gate before generation:** Classify the latest learner message first.
- **Context by intent:**
  - **Social intents** (greeting, gratitude, self_intro, meta_question): No lesson context. Short-circuit with fixed social/redirect responses; no OpenAI call.
  - **Guide intents** (confusion, follow_up, help_request): **Minimal context only** — current question + learner answer + instruction: “ONE next step or ONE guiding question. Do NOT repeat the lesson.”
  - **Explain intent** (content_question): Full lesson context allowed; instruction for short explanation and optional hints/example.
- **Single response mode set:** Only `social | guide | explain`. Prompt and `normalizeMode` enforce this; no “greeting”/“hint”/“explanation”/“redirect” modes that blurred social vs lesson.
- **Length in prompt:** Lila max 2 short sentences, Dan max 3 short sentences unless explain.

---

## 3. Exact preview URL

After pushing to **`preview/ace-tutor-transcript`**:

- **Vercel Dashboard** → your project → **Deployments** → latest deployment for **`preview/ace-tutor-transcript`** → when **Ready**, copy the **Preview** URL.
- Example pattern: `https://<project>-git-preview-ace-tutor-transcript-<team>.vercel.app`

Use that URL for all retests. Do not merge to main until those pass.

---

## 4. Exact prompts to retest

On the **preview** app, in a learn session with “Ask Dan” or “Ask Lila” open:

| # | Say | Expect |
|---|-----|--------|
| 1 | **my name is Elle** | Social only: short acknowledgment (e.g. “Nice to meet you, Elle!…”). No lesson block. |
| 2 | **I'm confused** | One next step or one guiding question only. No full lesson restart. |
| 3 | **What do I do next?** | Guide only: continues from conversation. No full explanation. |
| 4 | **thank you Lila** | Social only: short “You’re welcome” style. No lesson block. |
| 5 | **how old are you?** | Playful redirect only (e.g. “I’m a robot who loves helping with this question!”). No lesson block. |

**Pass:** 1, 4, 5 = short social/redirect only. 2, 3 = one step or continuation, no lesson restart.

---

## 5. Transcript logging

Unchanged: one row per turn; content = message + optional hints + example. No schema or API shape change.
