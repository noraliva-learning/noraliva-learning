# Bootstrap users (Auth + profiles)

This document explains how to run the automated bootstrap for Supabase Auth users and `profiles` rows (parent, liv, elle).

## Env setup (required before bootstrap)

The bootstrap script and the app read **`.env.local`** from the **repo root** (same folder as `package.json`). If `.env.local` is missing, `.env` is used as fallback.

### Step-by-step

1. **Create `.env.local`** in the repo root (next to `package.json`).
2. **Copy the template** from `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
3. **Open Supabase Dashboard → Project Settings → API** and paste each value into `.env.local`:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL=...`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY=...`
4. **Save the file.** Do not commit `.env.local` (it contains secrets).
5. **Restart** any running dev server or terminal so env vars are picked up.
6. **Run the bootstrap:**
   ```bash
   npm run bootstrap:users
   ```

### Troubleshooting (env)

| Issue | What to do |
|-------|------------|
| **Wrong file location** | `.env.local` must be in the **repo root** (the folder that contains `package.json` and `src/`). Not inside `src/` or `scripts/`. |
| **Changes not picked up** | Restart the terminal and/or `npm run dev` after editing `.env.local`. Env is loaded at process start. |
| **Quotes** | Use `KEY=value` with no quotes. Only add quotes if the value contains spaces. Avoid trailing spaces after `=`. |
| **Missing variable message** | Run `npm run env:check` (or `npm run check:env`) to see which variable is missing and the exact Dashboard field names. |

#### Common failure: spaces around `=`

Some tools (including Node/dotenv) can mis-parse lines that have spaces around the `=` sign, which can break auth silently. Use **no spaces** around `=`:

- **Correct:** `NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co`
- **Incorrect:** `NEXT_PUBLIC_SUPABASE_URL = https://xxxx.supabase.co` or `KEY = value`

Run `npm run env:check` to validate format. If validation fails (e.g. "spaces around ="), run **`npm run env:fix`** to normalize `.env.local` safely (no secrets printed), then run `npm run env:check` again. Restart the dev server after changing `.env.local`.

## Where to paste Supabase keys

Use **`.env.local`** in the **project root** (same folder as `package.json`). Copy from `.env.example` and fill in values from the Supabase dashboard. (If `.env.local` is missing, `.env` is used as fallback.)

**Supabase Dashboard → Project Settings → API**

| Variable | Where to paste | Notes |
|----------|----------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Safe for client (used in browser). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / public key | Safe for client. |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key | **Server-only.** Never expose in client code or commit to git. Required for `bootstrap:users`. |

Example `.env` (replace with your real values):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Exact run commands

1. **Install dependencies** (includes `tsx` and `dotenv` for the script):

   ```bash
   npm install
   ```

2. **Ensure migrations are applied** so `profiles` and RLS exist:

   - Either run your Supabase migrations (e.g. `supabase db push` or apply `00001_schema.sql` and `00002_rls.sql` in the SQL Editor).

3. **Run the bootstrap** (reads from `.env.local` or `.env`):

   ```bash
   npm run bootstrap:users
   ```

   Successful output looks like:

   ```
   Bootstrap: ensuring auth users...
     Created user: parent@noraliva.local (...)
     ...
   Bootstrap: upserting profiles...
     Profile upserted: parent (parent) Parent
     ...
   Bootstrap complete. Users (change passwords after first login):
     parent: parent@noraliva.local | liv: liv@noraliva.local | elle: elle@noraliva.local
     Default password: BootstrapPassword1!
   ```

The script is **idempotent**: safe to run multiple times. It reuses existing auth users by email and upserts profiles.

## RLS and service role

RLS stays **enabled**. The bootstrap uses the **service role** key, which bypasses RLS. Normal app usage (anon key) still obeys RLS; only this script and other server-side admin code should use the service role key.

## Troubleshooting

| Issue | What to do |
|-------|------------|
| `Missing NEXT_PUBLIC_SUPABASE_URL` or `Missing SUPABASE_SERVICE_ROLE_KEY` | Add all three required vars to `.env.local` in the project root. Restart the terminal / re-run the command after editing. Run `npm run env:check` for the exact list and where to get them. |
| `createUser(...): User already registered` | The script should detect existing users by email; if you see this, it may be from an older run. Check Supabase Auth → Users for `parent@noraliva.local`, etc. You can delete those users and run again, or the script will skip creation and only upsert profiles when the user exists. |
| `profiles upsert(...): ...` or relation "profiles" does not exist | Run the schema migration first (`00001_schema.sql`). |
| `listUsers error` or 401/403 | Confirm `SUPABASE_SERVICE_ROLE_KEY` is the **service_role** key (not anon). Regenerate in Supabase if needed. |
| Script runs but app can’t see profiles | Ensure you’re signing in with one of the bootstrap emails and the default password. RLS allows users to read their own profile and parents to read children’s. |
| Want different emails/passwords or kid details | Edit `scripts/bootstrap-users.ts`: change the `USERS` array and/or `BOOTSTRAP_PASSWORD`. Re-run `npm run bootstrap:users`. |

## Bootstrap users created

| Role   | Email                  | Profile fields (kids)     |
|--------|------------------------|---------------------------|
| parent | parent@noraliva.local  | display_name: Parent      |
| liv    | liv@noraliva.local     | display_name: Liv, age: 10, grade_label: Grade 5, parent_id → parent |
| elle   | elle@noraliva.local    | display_name: Elle, age: 8, grade_label: Grade 3, parent_id → parent |

Default password for all three: `BootstrapPassword1!` — change after first login.

## How to test

### Part A — Env validation and fix

- **Fail fast on bad format:** Put a space after `=` in `.env.local` (e.g. `SUPABASE_SERVICE_ROLE_KEY= sb_...`). Run:
  ```bash
  npm run env:check
  ```
  You should see a validation error with the line number and no secret values printed.

- **Auto-fix:** Run:
  ```bash
  npm run env:fix
  ```
  Then run `npm run env:check` again; it should pass.

- **Bootstrap fails fast:** With an invalid `.env.local`, `npm run bootstrap:users` should fail at env validation before running bootstrap.

### Part B — Role-based login and route guards

1. Start the app and ensure bootstrap has been run:
   ```bash
   npm run env:check
   npm run bootstrap:users
   npm run dev
   ```

2. **Parent login:** Open http://localhost:3000/v2/login → sign in as `parent@noraliva.local` / `BootstrapPassword1!` → you should land on **http://localhost:3000/v2/parent** (not a learner dashboard).

3. **Liv login:** Sign out, then sign in as `liv@noraliva.local` / `BootstrapPassword1!` → you should land on **http://localhost:3000/v2/learners/liv** (not parent dashboard).

4. **Elle login:** Sign out, then sign in as `elle@noraliva.local` / `BootstrapPassword1!` → you should land on **http://localhost:3000/v2/learners/elle**.

5. **Parent route guard:** While signed in as Liv, go to http://localhost:3000/v2/parent → you should be redirected to **http://localhost:3000/v2/learners/liv**.

6. **No redirect loops:** Reload each dashboard; no infinite redirects. Sign out from any dashboard and confirm you land on `/v2/login`.
