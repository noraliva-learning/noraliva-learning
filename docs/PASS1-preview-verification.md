# PASS 1 — Preview verification

**Branch:** `preview/adaptive-skill-graph-memory-scheduler`  
**Do not merge to main** until preview is validated.

---

## 1. Confirm preview deployment

- Open **Vercel Dashboard** → your Noraliva project → **Deployments**.
- Find the deployment for branch **`preview/adaptive-skill-graph-memory-scheduler`** (status: Ready/Building).
- Or open **GitHub** → repo → **Branches** → `preview/adaptive-skill-graph-memory-scheduler` → check for Vercel “View deployment” link in the PR or branch page.

---

## 2. Exact preview URL

Vercel assigns the URL per deployment. To get it:

1. **Vercel Dashboard** → Project → **Deployments** → click the deployment for `preview/adaptive-skill-graph-memory-scheduler` → copy the **Visit** URL (e.g. `https://noraliva-learning-git-preview-adaptive-skill-graph-memory-scheduler-<team>.vercel.app`).
2. Or in the **GitHub** PR for this branch, use the Vercel bot comment: **“View deployment”** / **Visit Preview**.

Use that URL as the **exact preview URL** for all checks below.

---

## 3. Exact checks to run on preview (3–5)

Run these **on the preview URL** (not production):

1. **Session flow (no prereq)**  
   Log in as a learner → pick a domain (e.g. Math) → **Start session** → choose **Level Up** or **Review & Shine** → confirm a plan is generated and you can answer at least one question and advance (next/submit). Session should complete without errors.

2. **Plan uses only eligible skills (with prereq seed)**  
   After running the prerequisite seed SQL below: **without** having mastery ≥ 0.85 on the prerequisite skill, start a **Math** session and generate a plan. Confirm the plan **only** contains exercises for the first skill (e.g. “Basic addition”), not the dependent skill (e.g. “Addition with carry”).

3. **Unlock after mastery**  
   In Supabase (or via the app until mastery updates): set `skill_mastery.mastery_probability` ≥ **0.85** for the learner on the **prerequisite** skill (e.g. `addition-basic`). Start a **Math** session again and generate a plan. Confirm the plan **can** include the dependent skill’s exercise(s).

4. **Safe fallback**  
   Temporarily break prerequisite evaluation (e.g. rename or drop `skill_prerequisites` in a dev DB, or use a branch that throws in `getSkillsWithPrerequisitesMet`). Start session → generate plan. The app should **not** crash; you should still get a plan (fallback: all domain skills eligible). Restore DB afterward.

5. **No regression**  
   Log in as parent and as learner; open domains list and mission/learn flows. Confirm nothing is broken and behavior matches expectations except for the new prerequisite filtering when a prereq is seeded.

---

## 4. SQL to seed one prerequisite (optional, for checks 2–3)

Run in **Supabase SQL Editor** against the project used by Noraliva.

```sql
-- Add a second Math skill that depends on "Basic addition" (addition-basic).
-- Prerequisite: skill_mastery.mastery_probability >= 0.85 for addition-basic.

-- 1) Insert second math skill (idempotent)
INSERT INTO public.skills (id, domain_id, unit_id, slug, name, sort_order)
SELECT
  'a0000006-0001-4000-8000-000000000006'::uuid,
  d.id,
  u.id,
  'addition-carry',
  'Addition with carry',
  1
FROM public.domains d
JOIN public.units u ON u.domain_id = d.id AND u.slug = 'foundations'
WHERE d.slug = 'math'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- 2) Lesson for new skill
INSERT INTO public.lessons (id, skill_id, title, sort_order)
SELECT
  'b0000006-0001-4000-8000-000000000006'::uuid,
  s.id,
  'Add with carry',
  0
FROM public.skills s
WHERE s.slug = 'addition-carry'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- 3) One exercise for new skill
INSERT INTO public.exercises (id, lesson_id, prompt, sort_order)
SELECT
  'c0000006-0001-4000-8000-000000000006'::uuid,
  l.id,
  'What is 15 + 7?',
  0
FROM public.lessons l
WHERE l.title = 'Add with carry'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- 4) Prerequisite: "Addition with carry" requires "Basic addition"
INSERT INTO public.skill_prerequisites (skill_id, prerequisite_skill_id)
SELECT
  'a0000006-0001-4000-8000-000000000006'::uuid,
  'a0000001-0001-4000-8000-000000000001'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM public.skill_prerequisites
  WHERE skill_id = 'a0000006-0001-4000-8000-000000000006'
    AND prerequisite_skill_id = 'a0000001-0001-4000-8000-000000000001'
);
```

After this:

- **Check 2:** With no (or low) mastery on `addition-basic`, Math plan should only show “Basic addition” / “What is 2 + 2?”.
- **Check 3:** Set for the learner: `skill_mastery` row for skill `a0000001-0001-4000-8000-000000000001` with `mastery_probability >= 0.85`; then Math plan can also show “Addition with carry” / “What is 15 + 7?”.

---

## 5. Do not merge to main

Keep all PASS 1 work on **`preview/adaptive-skill-graph-memory-scheduler`**. Merge to **main** only after you have run the checks above and are satisfied. Do not merge yet.
