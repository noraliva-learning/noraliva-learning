# ACE Conversational Upgrade — Preview Verification

**Branch:** `preview/ace-tutor-transcript` (pushed)  
**Do not merge to main** until verified.

---

## 1. Deploy preview

Vercel will build and deploy from the latest push to `preview/ace-tutor-transcript`.

**Get the exact preview URL:**
- **Vercel Dashboard** → your project → **Deployments**
- Open the latest deployment for branch **`preview/ace-tutor-transcript`**
- When status is **Ready**, copy the **Preview** URL (e.g. `https://noraliva-learning-git-preview-ace-tutor-transcript-<team>.vercel.app`)

---

## 2. Shortest verification checklist

Use the **preview URL** (not production). In a learn session, open “Ask Dan” or “Ask Lila” and try each prompt. Mark ✓ when the reply matches the expectation.

| # | You say | Expect |
|---|--------|--------|
| 1 | **Thank you Lila** | Short social reply only (e.g. “You’re welcome, Elle…”). No lesson block. |
| 2 | **Hi** | Short greeting only. No lesson block. |
| 3 | **My name is Elle** | Warm acknowledgment of name. No lesson block. |
| 4 | **I’m confused** | Simpler explanation or one next step. No long repeated block. |
| 5 | **What do I do next?** | Continues from prior reply. No full explanation restart. |
| 6 | **Can you help me?** | Conversational hint or short explanation. |
| 7 | **How old are you?** | Short, safe redirect. No lesson block. |

**Pass:** 1, 2, 3, 7 = short social/redirect only. 4, 5, 6 = conversational, no robotic repeat.

---

## 3. Transcript logging

**Question:** Does transcript logging still capture the visible tutor reply correctly?

**Answer:** Yes. The API still calls `formatTutorContent(response)` before inserting the tutor row. That function builds one string from:

- `message` (required)
- optional `"Hints: " + hints.join(" ")` when `hints.length > 0`
- optional `"Example: " + example` when `example` is non-empty

So the stored `content` is the same as what the learner sees in the chat (message first, then hints, then example). Parent transcript view and export are unchanged and show the full reply.

---

## 4. Summary

- **API:** Response shape is `message`, `mode`, `hints`, `example`, `shouldSpeak`. Short-circuits and fallbacks return this shape.
- **Prompt:** One ACE core prompt + Dan/Lila personality layer. Conversation = system + history + latest user message (+ lesson context).
- **Client:** Renders `message` first; appends hints/example only when present; uses `shouldSpeak` for TTS.
- **Transcript:** One coherent string per tutor turn (message + optional hints + optional example). No schema change.
