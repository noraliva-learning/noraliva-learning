/**
 * Bootstrap Auth users and profiles for Noraliva (parent, liv, elle).
 * Uses SUPABASE_SERVICE_ROLE_KEY only — never expose this client or key client-side.
 * Idempotent: safe to run multiple times.
 *
 * Run: npm run bootstrap:users
 * Requires: .env.local (or .env) with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { loadEnv, ensureEnv } from "./check-env";
import { createClient } from "@supabase/supabase-js";

loadEnv();
ensureEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Bootstrap user definitions: email, role, and profile fields for kids
const BOOTSTRAP_PASSWORD = "BootstrapPassword1!";

const USERS: Array<{
  key: "parent" | "liv" | "elle";
  email: string;
  role: "parent" | "liv" | "elle";
  display_name: string;
  age?: number;
  grade_label?: string | null;
}> = [
  { key: "parent", email: "parent@noraliva.local", role: "parent", display_name: "Parent" },
  { key: "liv", email: "liv@noraliva.local", role: "liv", display_name: "Liv", age: 10, grade_label: "Grade 5" },
  { key: "elle", email: "elle@noraliva.local", role: "elle", display_name: "Elle", age: 8, grade_label: "Grade 3" },
];

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error("listUsers error:", error.message);
    return null;
  }
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user?.id ?? null;
}

async function ensureUser(
  admin: ReturnType<typeof createClient>,
  email: string,
  password: string
): Promise<string> {
  const existing = await findUserByEmail(admin, email);
  if (existing) {
    console.log(`  User already exists: ${email} (${existing})`);
    return existing;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`createUser(${email}): ${error.message}`);
  }
  const id = data.user?.id;
  if (!id) throw new Error(`createUser(${email}): no id returned`);
  console.log(`  Created user: ${email} (${id})`);
  return id;
}

async function main() {
  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Bootstrap: ensuring auth users...");
  const ids: Record<string, string> = {};
  for (const u of USERS) {
    ids[u.key] = await ensureUser(admin, u.email, BOOTSTRAP_PASSWORD);
  }

  const parentId = ids.parent;
  console.log("\nBootstrap: upserting profiles...");

  for (const u of USERS) {
    const row = {
      id: ids[u.key],
      role: u.role,
      display_name: u.display_name,
      parent_id: u.role === "parent" ? null : parentId,
      age: u.age ?? null,
      grade_label: u.grade_label ?? null,
      challenge_style: "gentle" as const,
    };
    const { error } = await admin.from("profiles").upsert(row, {
      onConflict: "id",
      ignoreDuplicates: false,
    });
    if (error) {
      throw new Error(`profiles upsert(${u.key}): ${error.message}`);
    }
    console.log(`  Profile upserted: ${u.key} (${u.role}) ${u.display_name}`);
  }

  console.log("\nBootstrap complete. Users (change passwords after first login):");
  console.log("  parent:", USERS[0].email, "| liv:", USERS[1].email, "| elle:", USERS[2].email);
  console.log("  Default password:", BOOTSTRAP_PASSWORD);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
