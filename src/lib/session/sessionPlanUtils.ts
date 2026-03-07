/**
 * session_plan can be stored as string[] or { id: string; fallback?: boolean }[]
 * for debugging (fallback=true when plan was from domain fallback).
 */
export function getSessionPlanIds(plan: unknown): string[] {
  if (plan == null) return [];
  if (!Array.isArray(plan)) return [];
  return plan.map((p) => (typeof p === 'string' ? p : (p as { id: string }).id));
}
