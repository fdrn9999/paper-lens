import { Redis } from '@upstash/redis';

// ===== Upstash Redis client (lazy singleton) =====
let _redis: Redis | null = null;

function getRedis(): Redis {
    if (!_redis) {
          const url = process.env.KV_REST_API_URL;
          const token = process.env.KV_REST_API_TOKEN;
          if (!url || !token) {
                  throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN must be set');
          }
          _redis = new Redis({ url, token });
    }
    return _redis;
}

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30;

/**
 * @param key - Rate limit key (e.g. "translate:1.2.3.4") to allow per-endpoint buckets
 */
export async function checkRateLimit(key: string): Promise<{ allowed: boolean; retryAfterMs: number }> {
    try {
          const redis = getRedis();
          const redisKey = `rl:${key}`;
          const count = await redis.incr(redisKey);

      if (count === 1) {
              // First request in this window — set expiry
            await redis.pexpire(redisKey, WINDOW_MS);
      }

      if (count > MAX_REQUESTS) {
              const ttl = await redis.pttl(redisKey);
              return { allowed: false, retryAfterMs: ttl > 0 ? ttl : WINDOW_MS };
      }

      return { allowed: true, retryAfterMs: 0 };
    } catch (error) {
          // If Redis is down, allow the request (fail-open)
      console.error('Rate limit Redis error:', error);
          return { allowed: true, retryAfterMs: 0 };
    }
}

// ===== Daily usage quota (character-based, resets at UTC midnight) =====

function todayUTC(): string {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function secondsUntilMidnightUTC(): number {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return Math.ceil((tomorrow.getTime() - now.getTime()) / 1000);
}

/** Per-IP daily character limits */
export const DAILY_CHAR_LIMITS: Record<string, number> = {
    translate: parseInt(process.env.DAILY_TRANSLATE_CHAR_LIMIT || '50000', 10),
    embed: parseInt(process.env.DAILY_EMBED_CHAR_LIMIT || '100000', 10),
    chat: parseInt(process.env.DAILY_CHAT_CHAR_LIMIT || '100000', 10),
};

// ===== Global daily budget (all users combined, character-based) =====

const DAILY_GLOBAL_CHAR_LIMITS: Record<string, number> = {
    translate: parseInt(process.env.DAILY_GLOBAL_TRANSLATE_CHAR_LIMIT || '500000', 10),
    embed: parseInt(process.env.DAILY_GLOBAL_EMBED_CHAR_LIMIT || '1000000', 10),
    chat: parseInt(process.env.DAILY_GLOBAL_CHAT_CHAR_LIMIT || '1000000', 10),
};

export async function checkGlobalQuota(
    endpoint: string,
    charCount: number
  ): Promise<{ allowed: boolean; usedChars: number; limitChars: number; usedPercent: number }> {
    const limit = DAILY_GLOBAL_CHAR_LIMITS[endpoint] ?? 500000;

  try {
        const redis = getRedis();
        const today = todayUTC();
        const redisKey = `gq:${endpoint}:${today}`;

      // Get current usage
      const current = (await redis.get<number>(redisKey)) || 0;

      if (current + charCount > limit) {
              return {
                        allowed: false,
                        usedChars: current,
                        limitChars: limit,
                        usedPercent: Math.min(100, Math.round((current / limit) * 100)),
              };
      }

      // Increment and set expiry
      const newTotal = await redis.incrby(redisKey, charCount);
        const ttl = await redis.ttl(redisKey);
        if (ttl < 0) {
                await redis.expire(redisKey, secondsUntilMidnightUTC());
        }

      return {
              allowed: true,
              usedChars: newTotal,
              limitChars: limit,
              usedPercent: Math.round((newTotal / limit) * 100),
      };
  } catch (error) {
        console.error('Global quota Redis error:', error);
        // Fail-open: allow the request
      return { allowed: true, usedChars: 0, limitChars: limit, usedPercent: 0 };
  }
}

/**
 * Check daily usage quota for an endpoint + IP combination (character-based).
 */
export async function checkDailyQuota(
    endpoint: string,
    ip: string,
    charCount: number
  ): Promise<{ allowed: boolean; usedChars: number; limitChars: number; usedPercent: number }> {
    const limit = DAILY_CHAR_LIMITS[endpoint] ?? 50000;

  try {
        const redis = getRedis();
        const today = todayUTC();
        const redisKey = `dq:${endpoint}:${ip}:${today}`;

      // Get current usage
      const current = (await redis.get<number>(redisKey)) || 0;

      if (current + charCount > limit) {
              return {
                        allowed: false,
                        usedChars: current,
                        limitChars: limit,
                        usedPercent: Math.min(100, Math.round((current / limit) * 100)),
              };
      }

      // Increment and set expiry
      const newTotal = await redis.incrby(redisKey, charCount);
        const ttl = await redis.ttl(redisKey);
        if (ttl < 0) {
                await redis.expire(redisKey, secondsUntilMidnightUTC());
        }

      return {
              allowed: true,
              usedChars: newTotal,
              limitChars: limit,
              usedPercent: Math.round((newTotal / limit) * 100),
      };
  } catch (error) {
        console.error('Daily quota Redis error:', error);
        // Fail-open: allow the request
      return { allowed: true, usedChars: 0, limitChars: limit, usedPercent: 0 };
  }
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
