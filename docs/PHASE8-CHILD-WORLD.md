# Phase 8 — Buddy + Celebration + World Layer (Preview)

## New child-facing features

1. **Buddy selection** — Five placeholder buddies (owl, dinosaur, cupcake, sloth, monster) with emoji cards. Choice is saved to `profiles.buddy_slug` via `POST /api/v2/learner/buddy`. Shown on learner home and in practice sessions (`BuddyAvatar`).
2. **Buddy reactions** — Placeholder `BuddyAvatar` supports states: idle, encourage, celebrate, retry, completion (Framer Motion). Ready to swap for Rive later.
3. **Celebrations** — **Small:** brief overlay after a correct answer (`SmallCorrectCelebration`). **Big:** full-screen daily completion with dimmed backdrop, rainbow wash, falling emoji “confetti,” buddy, and copy: “Congratulations, you’re done for today. I’ll see you tomorrow.” (`DailyCompleteCelebration`), triggered when `POST /api/v2/learner/daily-progress` returns `dailyMinimumJustMet: true` (first qualifying practice of the UTC day).
4. **World / background** — `WorldBackground` applies a month-based gradient theme (spring / summer / winter / park) plus decorative layers. Used on learner home and session page.
5. **Daily mission** — “Do at least 1 today” card on home; progress stored in `learner_daily_mission` (UTC date). Marked when the learner submits their first checked answer in a session that day.
6. **Grade / level identity** — Home and session show `grade_label` and age from profile, with fallback from `getLearnerProfile(slug)`. Learners cannot change grade in-app (no learning-model bypass).
7. **Break** — “Need a break?” on the practice screen; `POST /api/v2/learner/break` records `learner_events` (`break_request`). Supportive `BreakOverlay`; resume returns to the lesson.
8. **Games** — “Games” section on home with Math / Spanish **Coming soon** cards (`GamesComingSoon`).
9. **Parent debug** — Parent dashboard shows per child: buddy, daily minimum today, break requests today (`getParentViewData`).

## Migrations

- **`supabase/migrations/00020_phase8_buddy_daily_world.sql`** — `profiles.buddy_slug`, `learner_daily_mission`, `learner_events` + RLS.

## API routes

| Route | Purpose |
|-------|---------|
| `POST /api/v2/learner/buddy` | Save buddy |
| `POST /api/v2/learner/daily-progress` | Mark daily minimum; returns `dailyMinimumJustMet` |
| `POST /api/v2/learner/break` | Log break request |
| `GET /api/v2/learner/preview-state` | Buddy, grade, today’s daily row |

## Preview deployment checklist

1. Run migration on Supabase (preview DB): `00020_phase8_buddy_daily_world.sql`.
2. Deploy branch to Vercel **preview**.
3. Smoke-test: login as Liv → home shows world + buddy picker → pick buddy → start Math practice → answer one question → small celebration; if first practice of the day → big daily celebration → home shows daily goal met.
4. Test break: “Need a break?” → overlay → resume.
5. Parent: open V2 parent dashboard → Phase 8 debug lines for each child.

## Manual test steps (Liv / Elle)

- **Liv:** Log in → `/v2/learners/liv` → pick buddy → confirm header shows Grade 2 + age → start practice → verify world background + buddy + grade chip on question line → correct answer → small celebration → first daily completion → big celebration → home shows daily check.
- **Elle:** Same; confirm Elle theme + Grade 1 copy.
- **Regression:** Submit wrong answer → “Let’s redo this” + buddy retry state.
- **Break:** Tap “Need a break?” → event stored → resume continues lesson.

## Next phase (not in this PR)

- Real character art / Rive wiring.
- Optional parent-editable grade in settings.
- First real mini-game loop.
- Deeper world parallax and seasonal assets (images).
