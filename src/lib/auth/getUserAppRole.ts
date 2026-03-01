/**
 * Resolves app role and learner slug for auth user (server-side only).
 * Uses profiles.role; falls back to email pattern (parent@..., liv@..., elle@...).
 */

import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRoleResult =
  | { role: "parent" }
  | { role: "learner"; learnerSlug: "liv" | "elle" };

export async function getUserAppRole(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">
): Promise<AppRoleResult> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role;
  if (role === "parent") return { role: "parent" };
  if (role === "liv") return { role: "learner", learnerSlug: "liv" };
  if (role === "elle") return { role: "learner", learnerSlug: "elle" };

  const email = (user.email ?? "").toLowerCase();
  if (email.startsWith("parent@")) return { role: "parent" };
  if (email.startsWith("liv@")) return { role: "learner", learnerSlug: "liv" };
  if (email.startsWith("elle@")) return { role: "learner", learnerSlug: "elle" };

  return { role: "parent" };
}

export function getDashboardPath(result: AppRoleResult): string {
  if (result.role === "parent") return "/v2/parent";
  return `/v2/learners/${result.learnerSlug}`;
}
