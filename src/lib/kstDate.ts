/**
 * KST (UTC+9) date helpers shared by the server quota logic and the client store,
 * so the daily-reset boundary is computed identically in both places.
 * `nowMs` is injectable for deterministic tests; it defaults to the current time.
 */

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Current KST date as "YYYY-MM-DD". */
export function todayKST(nowMs: number = Date.now()): string {
  return new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Seconds remaining until the next KST midnight (used as a Redis key TTL). */
export function secondsUntilMidnightKST(nowMs: number = Date.now()): number {
  const kst = new Date(nowMs + KST_OFFSET_MS);
  const tomorrowKST = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1));
  // tomorrowKST is midnight KST expressed in UTC-shifted time; convert back to real UTC.
  return Math.ceil((tomorrowKST.getTime() - KST_OFFSET_MS - nowMs) / 1000);
}
