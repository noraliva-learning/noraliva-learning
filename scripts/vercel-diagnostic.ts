/**
 * Read-only diagnostic: list projects visible to the token under the team.
 * Confirms whether the token can see the Noraliva project and what the API returns.
 *
 * Environment: VERCEL_TOKEN, and VERCEL_TEAM_ID or VERCEL_TEAM_SLUG (same as get-preview-url).
 *
 * Usage: npm run vercel:diagnostic
 */

import { config } from "dotenv";
import path from "node:path";

const VERCEL_API = "https://api.vercel.com";

interface VercelTeam {
  id: string;
  slug?: string;
  name?: string;
  [key: string]: unknown;
}

interface VercelProject {
  id: string;
  name: string;
  [key: string]: unknown;
}

function loadEnv(): void {
  const root = process.cwd();
  config({ path: path.join(root, ".env") });
  config({ path: path.join(root, ".env.local") });
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
    return null;
  }
  return team.id;
}

async function main(): Promise<void> {
  loadEnv();

  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.error("Missing VERCEL_TOKEN.");
    process.exit(1);
  }

  const teamId = await resolveTeamId(token);
  if (!teamId) {
    console.error("Could not resolve team. Set VERCEL_TEAM_ID or VERCEL_TEAM_SLUG.");
    process.exit(1);
  }

  console.log("Team ID (resolved):", teamId);
  console.log("");

  const projectsUrl = new URL("/v9/projects", VERCEL_API);
  projectsUrl.searchParams.set("teamId", teamId);

  const projRes = await fetch(projectsUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!projRes.ok) {
    console.error("Vercel API error (list projects):", projRes.status, projRes.statusText);
    console.error(await projRes.text());
    process.exit(1);
  }

  const projData = (await projRes.json()) as { projects?: VercelProject[] };
  const projects = projData.projects ?? [];

  console.log("--- Projects visible under this team ---");
  console.log("");

  for (const p of projects) {
    const name = p.name ?? "(no name)";
    const id = p.id ?? "(no id)";
    console.log("  name:", name);
    console.log("  id:  ", id);
    console.log("");
  }

  const noraliva = projects.find((p) => p.name === "noraliva-learning" || p.id === "prj_PCZFpAxk6NMKSBwTIrtxdk9PNHhF");
  const projectIdToTest = noraliva?.id ?? "prj_PCZFpAxk6NMKSBwTIrtxdk9PNHhF";
  console.log("--- Latest deployment for", projectIdToTest, "(noraliva-learning) ---");
  const deploymentsUrl = new URL("/v6/deployments", VERCEL_API);
  deploymentsUrl.searchParams.set("projectId", projectIdToTest);
  deploymentsUrl.searchParams.set("teamId", teamId);
  deploymentsUrl.searchParams.set("limit", "1");

  const depRes = await fetch(deploymentsUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!depRes.ok) {
    console.log("  deployments API response:", depRes.status, depRes.statusText);
    console.log("  body:", await depRes.text());
  } else {
    const depData = (await depRes.json()) as { deployments?: { target?: string; state?: string; url?: string }[] };
    const deploys = depData.deployments ?? [];
    if (deploys.length > 0) {
      const d = deploys[0];
      console.log("  target:", d.target ?? "—");
      console.log("  state: ", d.state ?? "—");
      console.log("  url:   ", d.url ?? "—");
    } else {
      console.log("  (no deployments)");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
