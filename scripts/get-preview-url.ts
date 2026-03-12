/**
 * Get the latest Vercel preview deployment URL and status for a branch.
 * Read-only: uses Vercel API GET /v6/deployments.
 * Supports team-scoped projects via VERCEL_TEAM_ID or VERCEL_TEAM_SLUG.
 *
 * Environment (e.g. .env.local):
 *   VERCEL_TOKEN       - Vercel API token (read-only is enough)
 *   VERCEL_PROJECT_ID  - Project ID from Vercel: Project → Settings → General
 *   VERCEL_TEAM_ID     - (Team projects) Team ID from Vercel: Team → Settings → General
 *   VERCEL_TEAM_SLUG   - (Team projects) Team slug from URL vercel.com/teams/<slug>/...
 *   Use either VERCEL_TEAM_ID or VERCEL_TEAM_SLUG for team-scoped projects.
 *
 * Usage: npm run preview:url -- <branch-name>
 * Example: npm run preview:url -- preview/adaptive-skill-graph-memory-scheduler
 */

import { config } from "dotenv";
import path from "node:path";

const VERCEL_API = "https://api.vercel.com";

interface VercelDeployment {
  uid: string;
  state: string;
  url?: string;
  meta?: {
    githubCommitRef?: string;
    githubCommitSha?: string;
    gitSource?: { ref?: string; sha?: string };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface VercelDeploymentsResponse {
  deployments: VercelDeployment[];
  [key: string]: unknown;
}

interface VercelTeam {
  id: string;
  slug?: string;
  name?: string;
  [key: string]: unknown;
}

function loadEnv(): void {
  const root = process.cwd();
  config({ path: path.join(root, ".env") });
  config({ path: path.join(root, ".env.local") });
}

function printEnvHelp(context: "missing_team" | "project_not_found"): void {
  console.error("");
  console.error("--- Env vars to check ---");
  console.error("  VERCEL_TOKEN       - From Vercel: Account/Team → Settings → Tokens. Create a token with access to this team.");
  console.error("  VERCEL_PROJECT_ID  - From Vercel: Open the project → Settings → General → Project ID (e.g. prj_...).");
  console.error("  For team-scoped projects, set exactly one of:");
  console.error("  VERCEL_TEAM_ID     - From Vercel: Open the team → Settings → General → Team ID.");
  console.error("  VERCEL_TEAM_SLUG   - From Vercel: URL is vercel.com/teams/<slug>/... ; use that <slug>.");
  console.error("");
}

async function resolveTeamId(token: string): Promise<string | null> {
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (teamId) return teamId;

  const slug = process.env.VERCEL_TEAM_SLUG?.trim();
  if (!slug) return null;

  const res = await fetch(`${VERCEL_API}/v2/teams`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error("Vercel API error (list teams):", res.status, res.statusText);
    return null;
  }
  const data = (await res.json()) as { teams?: VercelTeam[] };
  const teams = data.teams ?? [];
  const team = teams.find((t) => t.slug === slug);
  if (!team) {
    console.error(`No team found with slug "${slug}". Check VERCEL_TEAM_SLUG.`);
    console.error("Available team slugs:", teams.map((t) => t.slug).filter(Boolean).join(", ") || "(none)");
    return null;
  }
  return team.id;
}

async function getPreviewUrl(branch: string): Promise<void> {
  loadEnv();

  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();

  if (!token) {
    console.error("Missing VERCEL_TOKEN. Set it in .env.local or the environment.");
    console.error("  Get it from: Vercel → Account or Team → Settings → Tokens → Create.");
    process.exit(1);
  }
  if (!projectId) {
    console.error("Missing VERCEL_PROJECT_ID. Set it in .env.local or the environment.");
    console.error("  Get it from: Vercel → Open project → Settings → General → Project ID.");
    process.exit(1);
  }

  const teamId = await resolveTeamId(token);
  if (process.env.VERCEL_TEAM_SLUG?.trim() && !teamId) {
    console.error("VERCEL_TEAM_SLUG is set but no team was found with that slug. Check the slug or use VERCEL_TEAM_ID instead.");
    printEnvHelp("missing_team");
    process.exit(1);
  }

  const url = new URL("/v6/deployments", VERCEL_API);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("target", "preview");
  url.searchParams.set("gitBranch", branch);
  if (teamId) url.searchParams.set("teamId", teamId);

  const requestUrl = url.toString();
  const params: Record<string, string> = {
    projectId,
    target: "preview",
    gitBranch: branch,
  };
  if (teamId) params.teamId = teamId;
  console.error("[get-preview-url] GET /v6/deployments params:", JSON.stringify(params, null, 2));
  console.error("[get-preview-url] Request URL:", requestUrl);

  const res = await fetch(requestUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    let errJson: { error?: { code?: string; message?: string } } = {};
    try {
      errJson = JSON.parse(body) as typeof errJson;
    } catch {
      // ignore
    }
    console.error("Vercel API error:", res.status, res.statusText);
    if (body) console.error(body);
    if (res.status === 404 || errJson.error?.code === "not_found") {
      console.error("");
      console.error("Project or deployment not found. For team-scoped projects you must set team scope:");
      console.error("  - Add VERCEL_TEAM_ID (Team → Settings → General → Team ID), or");
      console.error("  - Add VERCEL_TEAM_SLUG (the slug from the URL: vercel.com/teams/<slug>/...).");
      console.error("Also confirm VERCEL_PROJECT_ID is the project under that team.");
      printEnvHelp("project_not_found");
    }
    process.exit(1);
  }

  const data = (await res.json()) as VercelDeploymentsResponse;
  const deployments = data.deployments ?? [];

  if (deployments.length === 0) {
    console.error(`No preview deployment found for branch: ${branch}`);
    console.error("  Push the branch and wait for Vercel to build, or check the branch name.");
    process.exit(1);
  }

  const latest = deployments[0];
  const state = (latest.state ?? "UNKNOWN") as string;
  const rawUrl = latest.url as string | undefined;
  const deploymentUrl = rawUrl
    ? (rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`)
    : `https://${latest.uid}.vercel.app`;
  const commitSha =
    (latest.meta?.githubCommitSha as string) ??
    (latest.meta?.gitSource?.sha as string) ??
    "—";

  console.log("");
  console.log("Branch:", branch);
  console.log("Status:", state);
  console.log("URL:", deploymentUrl);
  console.log("Commit:", commitSha);
  console.log("");
}

const branch = process.argv[2]?.trim();
if (!branch) {
  console.error("Usage: npm run preview:url -- <branch-name>");
  console.error("Example: npm run preview:url -- preview/adaptive-skill-graph-memory-scheduler");
  process.exit(1);
}

getPreviewUrl(branch).catch((err) => {
  console.error(err);
  process.exit(1);
});
