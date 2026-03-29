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

// ===== Daily usage quota (character-based, resets at UTC midnight) =====
const dailyUsage = new Map<string, { chars: number; resetDate: string }>();
let lastDailyCleanup = Date.now();

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function lazyDailyCleanup() {
  const now = Date.now();
  if (now - lastDailyCleanup < 60 * 60 * 1000) return; // cleanup hourly
  lastDailyCleanup = now;
  const today = todayUTC();
  for (const [key, value] of dailyUsage) {
    if (value.resetDate !== today) dailyUsage.delete(key);
  }
}

/** Per-IP daily character limits */
export const DAILY_CHAR_LIMITS: Record<string, number> = {
  translate: parseInt(process.env.DAILY_TRANSLATE_CHAR_LIMIT || '50000', 10),
  embed: parseInt(process.env.DAILY_EMBED_CHAR_LIMIT || '100000', 10),
};

// ===== Global daily budget (all users combined, character-based) =====
const globalDailyUsage = new Map<string, { chars: number; resetDate: string }>();

const DAILY_GLOBAL_CHAR_LIMITS: Record<string, number> = {
  translate: parseInt(process.env.DAILY_GLOBAL_TRANSLATE_CHAR_LIMIT || '500000', 10),
  embed: parseInt(process.env.DAILY_GLOBAL_EMBED_CHAR_LIMIT || '1000000', 10),
};

export function checkGlobalQuota(endpoint: string, charCount: number): { allowed: boolean; usedChars: number; limitChars: number; usedPercent: number } {
  const limit = DAILY_GLOBAL_CHAR_LIMITS[endpoint] ?? 500000;
  const key = `global:${endpoint}`;
  const today = todayUTC();
  const entry = globalDailyUsage.get(key);

  if (!entry || entry.resetDate !== today) {
    globalDailyUsage.set(key, { chars: charCount, resetDate: today });
    return { allowed: true, usedChars: charCount, limitChars: limit, usedPercent: Math.round((charCount / limit) * 100) };
  }

  if (entry.chars + charCount > limit) {
    return { allowed: false, usedChars: entry.chars, limitChars: limit, usedPercent: Math.min(100, Math.round((entry.chars / limit) * 100)) };
  }

  entry.chars += charCount;
  return { allowed: true, usedChars: entry.chars, limitChars: limit, usedPercent: Math.round((entry.chars / limit) * 100) };
}

/**
 * Check daily usage quota for an endpoint + IP combination (character-based).
 */
export function checkDailyQuota(
  endpoint: string,
  ip: string,
  charCount: number
): { allowed: boolean; usedChars: number; limitChars: number; usedPercent: number } {
  lazyDailyCleanup();
  const limit = DAILY_CHAR_LIMITS[endpoint] ?? 50000;
  const key = `daily:${endpoint}:${ip}`;
  const today = todayUTC();
  const entry = dailyUsage.get(key);

  if (!entry || entry.resetDate !== today) {
    dailyUsage.set(key, { chars: charCount, resetDate: today });
    return { allowed: true, usedChars: charCount, limitChars: limit, usedPercent: Math.round((charCount / limit) * 100) };
  }

  if (entry.chars + charCount > limit) {
    return { allowed: false, usedChars: entry.chars, limitChars: limit, usedPercent: Math.min(100, Math.round((entry.chars / limit) * 100)) };
  }

  entry.chars += charCount;
  return { allowed: true, usedChars: entry.chars, limitChars: limit, usedPercent: Math.round((entry.chars / limit) * 100) };
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
