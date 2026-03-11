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

- Vercel dashboard → Deployments → latest deployment for that branch, or  
- Git push output (e.g. `https://noraliva-learning-xxx-…vercel.app`).

Preview branch: `preview/ask-ace` (or as chosen).

## 3. Unchanged

- **Transcript logging:** Every learner and Ace turn still logged; `insertTutorTranscriptRow` unchanged; `resolvedHelperName` remains (value "Ace") for transcript metadata.
- **Parent transcript page and export:** Unchanged.
- **Text input + mic input:** Unchanged.
- **Text-to-speech:** Unchanged (`shouldSpeak`, existing TTS path).
- **Child safety:** Kid-safe, no personal questions, warm off-topic redirect still in prompt and intent handling.
- **Lesson context:** Still passed (question, learner answer, domain, skill, history) when relevant; used for dialogue, not as a rigid script.

## 4. Short test plan (5 prompts)

| User says | Expect |
|-----------|--------|
| "My name is Elle" | Short-circuit self_intro: Ace says something like "Nice to meet you, Elle! I'm Ace. Ask me if you want help." |
| "I'm confused" | Guide-style: one simple next step or short hint (no full lesson repeat). |
| "What do I do next?" | Guide-style: one next step or one guiding question from conversation/lesson. |
| "Thank you Ace" | Short-circuit gratitude: Ace says you're welcome, warm and brief. |
| "How old are you?" | Off-topic / meta: warm redirect to the question (e.g. "I'm here to help with this question—let's focus on that!"). |

Manual: open a session, open Ask Ace, type each phrase, confirm response type and tone.
