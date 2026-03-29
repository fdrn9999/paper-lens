const requestCounts = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30;
let lastCleanup = Date.now();

function lazyCleanup() {
  const now = Date.now();
  if (now - lastCleanup < WINDOW_MS) return;
  lastCleanup = now;
  for (const [key, value] of requestCounts) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }
}

/**
 * @param key - Rate limit key (e.g. "translate:1.2.3.4") to allow per-endpoint buckets
 */
export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  lazyCleanup();
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now > entry.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterMs: entry.resetTime - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

// ===== Daily quota (per-IP, resets at UTC midnight) =====
const dailyCounts = new Map<string, { count: number; resetDate: string }>();
let lastDailyCleanup = Date.now();

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function lazyDailyCleanup() {
  const now = Date.now();
  if (now - lastDailyCleanup < 60 * 60 * 1000) return; // cleanup hourly
  lastDailyCleanup = now;
  const today = todayUTC();
  for (const [key, value] of dailyCounts) {
    if (value.resetDate !== today) dailyCounts.delete(key);
  }
}

export const DAILY_LIMITS: Record<string, number> = {
  translate: 50,
  embed: 20,
};

// ===== Global daily budget (all users combined, protects against cost overrun) =====
const globalDailyCounts = new Map<string, { count: number; resetDate: string }>();

const DAILY_GLOBAL_LIMITS: Record<string, number> = {
  translate: parseInt(process.env.DAILY_GLOBAL_TRANSLATE_LIMIT || '500', 10),
  embed: parseInt(process.env.DAILY_GLOBAL_EMBED_LIMIT || '200', 10),
};

export function checkGlobalQuota(endpoint: string): { allowed: boolean; remaining: number; limit: number } {
  const limit = DAILY_GLOBAL_LIMITS[endpoint] ?? 500;
  const key = `global:${endpoint}`;
  const today = todayUTC();
  const entry = globalDailyCounts.get(key);

  if (!entry || entry.resetDate !== today) {
    globalDailyCounts.set(key, { count: 1, resetDate: today });
    return { allowed: true, remaining: limit - 1, limit };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, limit };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, limit };
}

/**
 * Check daily quota for an endpoint + IP combination.
 * @returns allowed, remaining count, and total limit
 */
export function checkDailyQuota(
  endpoint: string,
  ip: string
): { allowed: boolean; remaining: number; limit: number } {
  lazyDailyCleanup();
  const limit = DAILY_LIMITS[endpoint] ?? 50;
  const key = `daily:${endpoint}:${ip}`;
  const today = todayUTC();
  const entry = dailyCounts.get(key);

  if (!entry || entry.resetDate !== today) {
    dailyCounts.set(key, { count: 1, resetDate: today });
    return { allowed: true, remaining: limit - 1, limit };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, limit };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, limit };
}

/**
 * Extracts client IP from request headers.
 * Uses the rightmost IP in x-forwarded-for to prevent spoofing
 * (the rightmost value is set by the nearest trusted proxy).
 * On platforms like Vercel, the platform overwrites these headers so they are trustworthy.
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim());
    // Rightmost IP is added by the nearest trusted proxy, harder to spoof
    return ips[ips.length - 1] || 'unknown';
  }
  return headers.get('x-real-ip') || 'unknown';
}
