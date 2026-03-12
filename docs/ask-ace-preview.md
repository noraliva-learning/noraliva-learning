# Ask Ace — Preview Deliverables

Single tutor identity: **Ace** only. No Dan/Lila. Learner talks directly to Ace; natural conversation, lesson help through dialogue.

## 1. Files changed

| File | Change |
|------|--------|
| `src/app/v2/learn/session/[sessionId]/SessionFlow.tsx` | `helperName = 'Ace'` always (removed Dan/Lila by learner). |
| `src/app/v2/learn/session/[sessionId]/AceChatPanel.tsx` | Single Ace auto-greeting: "Hi [name]! I'm Ace. Ask me if you want help with the question." |
| `src/app/api/v2/ace/help/route.ts` | One `ACE_PROMPT` (warm, conversational, lesson-aware); removed `DAN_LAYER`/`LILA_LAYER`; all short-circuit responses Ace-only; relaxed instructions for natural replies. |

## 2. Preview URL

After pushing to the preview branch, get the URL from:

- **Vercel dashboard:** Project → **Deployments** → click the latest deployment for branch `preview/ask-ace` → copy the deployment URL.
- **GitHub PR:** If you open a PR from `preview/ask-ace`, Vercel usually comments with the preview URL, or it appears in the PR checks.

Preview branch: `preview/ask-ace`. **Do not merge to main until you've verified the preview.**

## 3. Unchanged

- **Transcript logging:** Every learner and Ace turn still logged; `insertTutorTranscriptRow` unchanged; `resolvedHelperName` remains (value "Ace") for transcript metadata.
- **Parent transcript page and export:** Unchanged.
- **Text input + mic input:** Unchanged.
- **Text-to-speech:** Unchanged (`shouldSpeak`, existing TTS path).
- **Child safety:** Kid-safe, no personal questions, warm off-topic redirect still in prompt and intent handling.
- **Lesson context:** Still passed (question, learner answer, domain, skill, history) when relevant; used for dialogue, not as a rigid script.

## 4. Short test plan (5 prompts)

**Checklist (preview only):**

- [ ] **"My name is Elle"** → Ace: "Nice to meet you, Elle! I'm Ace. Ask me if you want help."
- [ ] **"I'm confused"** → Ace: one simple next step or short hint (no full lesson).
- [ ] **"What do I do next?"** → Ace: one next step or one guiding question.
- [ ] **"Thank you Ace"** → Ace: you're welcome, warm and brief.
- [ ] **"How old are you?"** → Ace: warm redirect to the question (e.g. "I'm here to help with this question—let's focus on that!").

Open a session → Ask Ace → type each phrase → check response.
