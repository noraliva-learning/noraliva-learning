/**
 * One-off: verify Liv auth user and profile exist in the Supabase project (service role).
 * Run: npx tsx scripts/verify-liv-data.ts
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = "liv@noraliva.local";
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error("listUsers error:", listError.message);
    process.exit(1);
  }
  const authUser = listData.users.find((u) => u.email?.toLowerCase() === email);
  if (!authUser) {
    console.error("No auth user found for", email);
    process.exit(1);
  }
  console.log("Auth user:", { id: authUser.id, email: authUser.email });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, display_name, parent_id")
    .eq("id", authUser.id)
    .maybeSingle();
  if (profileError) {
    console.error("profiles select error:", profileError.message);
    process.exit(1);
  }
  if (!profile) {
    console.error("No profiles row for id", authUser.id);
    process.exit(1);
  }
  console.log("Profile:", profile);
  console.log("getUserAppRole expects: role in ('parent','liv','elle'). Liv role:", profile.role);
}

main();
