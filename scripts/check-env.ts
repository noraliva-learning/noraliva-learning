/**
 * Checks that required Supabase env vars are set (from .env.local or .env).
 * Use before bootstrap or other scripts that need Supabase credentials.
 * Never logs secret values.
 *
 * Run: npm run check:env
 */

import path from "node:path";
import { config } from "dotenv";
import { validateEnvFileAndExit } from "./validate-env-file";

const REQUIRED_VARS = [
  { name: "NEXT_PUBLIC_SUPABASE_URL" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY" },
  { name: "SUPABASE_SERVICE_ROLE_KEY" },
] as const;

/**
 * Load .env then .env.local from repo root (cwd). .env.local overrides .env.
 */
export function loadEnv(): void {
  const root = process.cwd();
  config({ path: path.join(root, ".env") });
  config({ path: path.join(root, ".env.local") });
}

/**
 * Verify required vars exist and are non-empty. On failure prints a friendly
 * message and exits with 1. Never prints actual key values.
 */
export function ensureEnv(): void {
  loadEnv();

  const missing = REQUIRED_VARS.filter((v) => !process.env[v.name]?.trim());

  if (missing.length === 0) {
    return;
  }

  console.error("\n❌ Missing required environment variable(s):");
  missing.forEach((v) => console.error(`   • ${v.name}`));

  console.error(`
Where to get these values:
   1. Open Supabase Dashboard → Project Settings → API
   2. Map each variable as follows:

   | Env variable (use in .env.local)     | Dashboard field        |
   |--------------------------------------|------------------------|
   | NEXT_PUBLIC_SUPABASE_URL             | Project URL            |
   | NEXT_PUBLIC_SUPABASE_ANON_KEY        | anon public            |
   | SUPABASE_SERVICE_ROLE_KEY            | service_role (secret)   |

What to do:
   1. Create a file named .env.local in the repo root (same folder as package.json).
   2. Add each variable on its own line: VARIABLE_NAME=value (no quotes unless the value contains spaces).
   3. Restart the terminal or dev server so the new values are picked up.
   4. Run again: npm run check:env  or  npm run bootstrap:users

Do NOT commit .env.local or share it; it contains secrets.
`);

  process.exit(1);
}

function main(): void {
  validateEnvFileAndExit();
  loadEnv();
  const missing = REQUIRED_VARS.filter((v) => !process.env[v.name]?.trim());
  if (missing.length > 0) {
    ensureEnv(); // prints message and exit(1)
  }
  process.exit(0);
}

// Only run when this file is the entry point (npm run check:env), not when imported
const isEntry = process.argv[1]?.replace(/\\/g, "/").endsWith("check-env.ts");
if (isEntry) {
  main();
}
