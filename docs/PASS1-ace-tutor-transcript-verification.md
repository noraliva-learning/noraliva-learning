# PASS 1: ACE Tutor + Transcript — Preview Verification

**Branch:** `preview/ace-tutor-transcript`  
**Status:** Pushed to `origin`. Do **not** merge to `main` until you verify.

---

## 1. Preview URL (Vercel)

After the push, Vercel builds and deploys a **preview** for this branch.

**To get the exact preview URL:**

1. Open **Vercel Dashboard** → your project (e.g. `noraliva-learning`).
2. Go to **Deployments**.
3. Find the latest deployment for branch **`preview/ace-tutor-transcript`** (triggered by the push).
4. When status is **Ready**, click the deployment.
5. Copy the **Preview URL** (e.g. `https://noraliva-learning-git-preview-ace-tutor-transcript-xxx.vercel.app` or similar).

**Alternatively:** If the repo is connected to GitHub, open the PR link from the push message and check the Vercel check; the “Details” link on the deployment often goes to the preview URL.

**Exact preview URL (yours):**  
_Use the URL from the Vercel deployment for branch `preview/ace-tutor-transcript` as above._

---

## 2. Apply migration to the preview database

The preview app must use a Supabase project. Use the **same** Supabase project that Vercel preview uses (the one whose env vars are set in Vercel for this project).

**Apply migration `00012_tutor_transcript.sql`:**

### Option A — Supabase Dashboard (recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and open the **project linked to your Vercel preview** (same as production if you use one project for both; otherwise the preview-specific project).
2. In the left sidebar, open **SQL Editor**.
3. Click **New query**.
4. Open the file `supabase/migrations/00012_tutor_transcript.sql` locally and copy its **entire** contents.
5. Paste into the SQL Editor.
6. Click **Run** (or Ctrl+Enter).
7. Confirm no errors. You should see “Success. No rows returned.”

### Option B — Supabase CLI

From the repo root, with the correct project linked (e.g. preview):

```bash
supabase db push
```

Or to run only this migration against the remote DB:

```bash
supabase migration up
```

(Use the project linked via `supabase link` for your preview environment.)

**Important:** The preview deployment must use a Supabase project that has this migration applied. If preview uses the same DB as production, run the migration once there and both will work. If you use a separate preview DB, run the migration on that project.

---

## 3. Five-step smoke test (after preview is live)

Do these steps on the **preview URL** (not production).

### Step 1 — Learner: ask Dan/Lila by text

1. Open the preview URL in a browser.
2. Log in as **Liv** or **Elle** (learner).
3. Go to **Learn** / start a session (e.g. Math).
4. When a question is shown, open **“Ask Dan”** (for Liv) or **“Ask Lila”** (for Elle).
5. Type a short message (e.g. “Can you give me a hint?”) and send.
6. **Pass:** You get a helpful reply from Dan or Lila (no error, no repeated full lesson block for a simple hint).

### Step 2 — Learner: ask Dan/Lila by voice

1. Still in the same session, in the tutor panel click the **microphone / “Ask [Dan|Lila]”** voice button.
2. Allow microphone if prompted; say something (e.g. “What should I do first?”).
3. **Pass:** Your speech appears as text and the tutor replies (no error).

### Step 3 — Parent: open Tutor transcript

1. Log out (or use an incognito window / another browser).
2. Log in as the **parent**.
3. From the parent dashboard, click **“Tutor transcript”**.
4. **Pass:** The Tutor transcript page loads and shows “Tutor transcript” and the filters (Learner, From date, To date). If there is no data yet, the list can be empty.

### Step 4 — Parent: filter by learner and date

1. On the Tutor transcript page, choose a **Learner** (e.g. Liv or Elle) from the dropdown, or leave “All”.
2. Set **From date** and/or **To date** if you want a range.
3. Click **Refresh**.
4. **Pass:** The list updates. After Step 1 and Step 2, you should see the learner’s messages and the tutor’s replies, in order, with timestamps and helper name (Dan/Lila). Voice messages should show `(voice)` in the row.

### Step 5 — Parent: export JSON

1. On the Tutor transcript page, with filters applied as you like, click **“Export JSON”**.
2. **Pass:** A JSON file downloads (e.g. `tutor-transcript-….json`) containing a `transcript` array with the same entries (id, learner_id, session_id, created_at, helper_name, role, content, input_source, metadata).

---

## 4. After verification

- If something fails: note which step and what you saw; we can fix on the same branch and push again.
- If all five steps pass: you can approve and plan a merge to `main` when you’re ready (still no merge until you explicitly approve).

---

## 5. Scope (unchanged)

- No merge to `main` until you verify.
- Preview only; implementation limited to what was summarized (ACE tutor context + intent short-circuits, transcript logging, transcript API, parent transcript page with filters and Export JSON).
