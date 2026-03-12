# Liv & Elle Learning Arcade (Noraliva Learning)

Foundation for the Elite Adaptive Learning System for Liv (7, Grade 2) and Elle (5, Grade 1).

## Required env vars (set in Vercel and .env.local for local dev)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for bootstrap | Server-only; do not expose to client |
| `OPENAI_API_KEY` | For full MVP | Tutor (Ask Ace) + AI exercises. If unset: tutor shows "AI unavailable"; exercises use fallback math |

See `.env.example` and `docs/MVP-DEPLOYMENT.md` for full deployment checklist.

## Local dev

```bash
npm install
npm run check:env   # optional: validate .env.local
npm run dev
```
