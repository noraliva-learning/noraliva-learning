/**
 * Validates .env.local format: exactly KEY=VALUE, no spaces around "=",
 * no trailing whitespace, KEY matches [A-Z0-9_]+.
 * Used by check-env before loading dotenv. Never prints secret values.
 *
 * Run: npm run env:check (via check-env.ts) or directly: tsx scripts/validate-env-file.ts
 */

import fs from "node:fs";
import path from "node:path";

const KEY_REGEX = /^[A-Z0-9_]+$/;

export type LineIssue =
  | { line: number; kind: "spaces_around_equals"; key: string }
  | { line: number; kind: "trailing_whitespace"; key: string }
  | { line: number; kind: "invalid_key"; key: string }
  | { line: number; kind: "multiple_equals_or_empty_key"; raw: string };

/**
 * Validate env file format only. Returns issues with line numbers (never includes secret values).
 * If file does not exist, returns empty (check-env will report missing vars after load).
 */
export function validateEnvFile(): LineIssue[] {
  const root = process.cwd();
  const filePath = path.join(root, ".env.local");
  const issues: LineIssue[] = [];

  if (!fs.existsSync(filePath)) {
    return issues;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);

    if (key !== key.trimEnd() || value !== value.trimStart()) {
      issues.push({ line: lineNum, kind: "spaces_around_equals", key: key.trim() || "(empty key)" });
      continue;
    }

    if (line !== line.trimEnd()) {
      issues.push({ line: lineNum, kind: "trailing_whitespace", key: key.trim() || "(empty key)" });
      continue;
    }

    const keyTrimmed = key.trim();
    if (!keyTrimmed) {
      issues.push({ line: lineNum, kind: "multiple_equals_or_empty_key", raw: "(empty key)" });
      continue;
    }
    if (!KEY_REGEX.test(keyTrimmed)) {
      issues.push({ line: lineNum, kind: "invalid_key", key: keyTrimmed });
    }
  }

  return issues;
}

/**
 * Run validation and exit with 1 on failure. Prints messages only (no secret values).
 */
export function validateEnvFileAndExit(): void {
  const issues = validateEnvFile();
  if (issues.length === 0) return;

  console.error("\n❌ .env.local format validation failed:\n");

  for (const i of issues) {
    if (i.kind === "spaces_around_equals") {
      console.error(`   Line ${i.line} (${i.key}): spaces around "=" — use KEY=value with no spaces around =.`);
    } else if (i.kind === "trailing_whitespace") {
      console.error(`   Line ${i.line} (${i.key}): trailing whitespace at end of line.`);
    } else if (i.kind === "invalid_key") {
      console.error(`   Line ${i.line} (${i.key}): key must contain only A-Z, 0-9, and underscore.`);
    } else {
      console.error(`   Line ${i.line}: invalid line (empty key or format).`);
    }
  }

  console.error(`
Fix: remove spaces around "=", trim trailing spaces, and use keys like KEY=value.
To auto-fix format (no secrets printed): npm run env:fix
Then run again: npm run env:check
`);
  process.exit(1);
}

const isEntry = process.argv[1]?.replace(/\\/g, "/").endsWith("validate-env-file.ts");
if (isEntry) {
  validateEnvFileAndExit();
}
