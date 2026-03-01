/**
 * Normalizes .env.local: removes spaces around "=", trims trailing whitespace.
 * Preserves comments and blank lines. Never prints secret values.
 *
 * Run: npm run env:fix
 */

import fs from "node:fs";
import path from "node:path";

function normalizeLine(line: string): { normalized: string; changed: boolean } {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#")) {
    const changed = line !== line.trimEnd();
    return { normalized: line.trimEnd() || line, changed };
  }
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) return { normalized: line, changed: false };

  const key = trimmed.slice(0, eqIndex).trimEnd();
  const value = trimmed.slice(eqIndex + 1).trimStart();
  const normalized = `${key}=${value}`;
  const changed = line !== normalized && line.trimEnd() !== normalized;
  return { normalized, changed };
}

function main(): void {
  const root = process.cwd();
  const filePath = path.join(root, ".env.local");

  if (!fs.existsSync(filePath)) {
    console.error(".env.local not found in repo root. Create it first, then run npm run env:fix");
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const changedLines: number[] = [];
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const { normalized, changed } = normalizeLine(lines[i]);
    if (changed) changedLines.push(i + 1);
    out.push(normalized);
  }

  fs.writeFileSync(filePath, out.join("\n") + (content.endsWith("\n") ? "\n" : ""), "utf-8");

  if (changedLines.length > 0) {
    console.log("Normalized .env.local — lines changed:", changedLines.join(", "));
  } else {
    console.log(".env.local already valid; no changes.");
  }
}

main();
