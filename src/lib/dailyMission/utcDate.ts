/**
 * UTC calendar date string YYYY-MM-DD for daily mission boundaries.
 */

export function utcDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Whether daily minimum just crossed from false → true (for big celebration). */
export function computeDailyJustMet(beforeMet: boolean, afterMet: boolean): boolean {
  return !beforeMet && afterMet;
}
