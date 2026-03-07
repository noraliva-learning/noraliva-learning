/**
 * Check whether migration 00010_ai_exercises.sql policies exist on the current Supabase project.
 * Run: npx tsx scripts/check-00010-policies.ts
 * Requires: .env.local with DATABASE_URL (Supabase Dashboard → Project Settings → Database → Connection string, URI)
 * If DATABASE_URL is not set, prints the SQL to run in SQL Editor and exits.
 */

import path from "node:path";
import { config } from "dotenv";

const root = process.cwd();
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL?.trim();

const POLICY_CHECK_SQL = `SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('lessons', 'exercises')
  AND policyname IN ('lessons_insert_authenticated', 'exercises_insert_authenticated')
ORDER BY tablename, policyname;`;

async function main() {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL is not set in .env.local.");
    console.error("");
    console.error("To run this check:");
    console.error("1. Supabase Dashboard → Project Settings → Database");
    console.error("2. Copy the 'Connection string' (URI) and add to .env.local:");
    console.error("   DATABASE_URL=postgresql://postgres.[ref]:[YOUR-PASSWORD]@...");
    console.error("3. Run: npx tsx scripts/check-00010-policies.ts");
    console.error("");
    console.error("Or run the following SQL in Supabase Dashboard → SQL Editor and paste the result:");
    console.error("---");
    console.error(POLICY_CHECK_SQL);
    console.error("---");
    process.exit(1);
  }

  const { Client } = await import("pg");
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query(POLICY_CHECK_SQL);
    const rows = res.rows as { schemaname: string; tablename: string; policyname: string }[];
    const hasLessons = rows.some((r) => r.policyname === "lessons_insert_authenticated");
    const hasExercises = rows.some((r) => r.policyname === "exercises_insert_authenticated");
    console.log(JSON.stringify({ policies: rows, lessons_insert_authenticated: hasLessons, exercises_insert_authenticated: hasExercises, migration_00010_applied: hasLessons && hasExercises }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
