# Ask Ace Direct — Preview Deliverables

Direct conversational route: learner → Ask Ace API → OpenAI → natural reply → transcript logging. No intent router, no short-circuits, no modes, no forced hints/example.

## 1. Exact files changed

| File | Change |
|------|--------|
| `src/app/api/v2/ace/help/route.ts` | Replaced with direct flow: one system prompt, history + learner message + compact lesson context → OpenAI → parse `{ message, shouldSpeak }` or plain text. Removed: intent router, short-circuit templates, modes, fallbackAceHelp, hints/example in response. |

UI already uses "Ask Ace" (SessionFlow.tsx, AceChatPanel.tsx); no changes there.

## 2. Exact preview URL

After pushing branch `preview/ask-ace-direct`:

- **Vercel dashboard:** Project → **Deployments** → latest deployment for branch `preview/ask-ace-direct` → copy URL.
- **GitHub PR:** Open PR from `preview/ask-ace-direct`; Vercel often comments with the preview URL.

Do not merge to main until verified.

## 3. Exact system prompt used

```
You are Ace, a warm, intelligent learning companion for children.
Speak naturally.
Respond to the learner's conversational meaning first.
Help with the lesson through dialogue, not canned blocks.
Keep language child-safe and age-appropriate.
Do not ask for school, address, or location.
Be warm, clear, and intelligent.
```

## 4. Exact lesson context payload sent

Compact text only, appended to the user message when present:

- **Format:** `[Lesson context] Current question: <prompt up to 400 chars>. Learner's answer so far: <answer up to 200 chars>. Domain: <domain>. Skill: <skillName>.`
- **Omitted when empty:** If no prompt/answer/domain/skill, the user message is just `Learner: <question>`.

Example:

```
Learner: I'm confused

[Lesson context] Current question: What is 3 + 4?. Learner's answer so far: 5. Domain: math. Skill: Addition within 10.
```

## 5. Plain response shape

API returns only:

```json
{
  "message": "natural reply",
  "shouldSpeak": true
}
```

No `hints`, `example`, or `mode`. Frontend already treats them as optional and shows only `message` when present.

## 6. Transcript logging and parent transcript reporting

- **Learner turn:** Logged before the OpenAI call via `insertTutorTranscriptRow` (role `learner`, content = question, same metadata as before).
- **Ace turn:** Logged after parsing the reply via `insertTutorTranscriptRow` (role `tutor`, content = `response.message`).
- **Parent transcript page and export:** Unchanged; they read from the same `tutor_transcript` table and schema.

## 7. Voice

- Mic input and TTS unchanged; `shouldSpeak` is returned and used by the existing UI.

---

## 8. Short test plan (5 prompts)

| # | User says | Check |
|---|------------|--------|
| 1 | **My name is Elle** | Ace responds naturally (e.g. nice to meet you, use name); no canned block. |
| 2 | **I'm confused** | Ace gives a simple next step or short help in natural language. |
| 3 | **What do I do next?** | Ace suggests one next step or guiding question. |
| 4 | **Thank you Ace** | Ace says you're welcome, warm and brief. |
| 5 | **How old are you?** | Ace redirects warmly to the question (no school/location); child-safe. |

**How to run:** Open a session on the preview URL → Ask Ace → type each phrase → confirm natural, conversational reply.
