import { Redis } from '@upstash/redis';
import { todayKST, secondsUntilMidnightKST } from './kstDate';

export { getClientIp } from './clientIp';

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

      // Self-heal the expiry: set it whenever the key has no TTL (not only when count===1).
      // A lost pexpire could otherwise leave the key immortal → that IP throttled forever.
      const ttl = await redis.pttl(redisKey);
      if (ttl < 0) await redis.pexpire(redisKey, WINDOW_MS);

      if (count > MAX_REQUESTS) {
              return { allowed: false, retryAfterMs: ttl > 0 ? ttl : WINDOW_MS };
      }

      return { allowed: true, retryAfterMs: 0 };
    } catch (error) {
          // Per-minute limiter stays fail-open (availability over strictness).
      console.error('Rate limit Redis error:', error);
          return { allowed: true, retryAfterMs: 0 };
    }
}

// ===== Daily usage quota (character-based, resets at KST midnight / UTC+9) =====
// KST date helpers live in ./kstDate so they can be unit-tested deterministically.

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
        const today = todayKST();
        const redisKey = `gq:${endpoint}:${today}`;

      // Increment first, then roll back if over the limit. B-07 accepted tolerance:
      // two requests near the cap can both incr, both see over-limit, and both decr,
      // so `usedChars` may transiently over-report and a request that would have fit
      // can be denied. This self-heals on the next call; we accept it rather than move
      // to a Lua script, which would gate all AI on an unverified atomic path.
      const newTotal = await redis.incrby(redisKey, charCount);
        const ttl = await redis.ttl(redisKey);
        if (ttl < 0) {
                await redis.expire(redisKey, secondsUntilMidnightKST());
        }

      if (newTotal > limit) {
              // Rollback and deny
              await redis.decrby(redisKey, charCount);
              return {
                        allowed: false,
                        usedChars: newTotal - charCount,
                        limitChars: limit,
                        usedPercent: Math.min(100, Math.round(((newTotal - charCount) / limit) * 100)),
              };
      }

      return {
              allowed: true,
              usedChars: newTotal,
              limitChars: limit,
              usedPercent: Math.round((newTotal / limit) * 100),
      };
  } catch (error) {
        // Global budget gates real API cost → fail CLOSED when Redis is unavailable.
        console.error('Global quota Redis error:', error);
        return { allowed: false, usedChars: 0, limitChars: limit, usedPercent: 100 };
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
        const today = todayKST();
        const redisKey = `dq:${endpoint}:${ip}:${today}`;

      // Increment first, then roll back if over the limit. B-07 accepted tolerance:
      // two requests near the cap can both incr, both see over-limit, and both decr,
      // so `usedChars` may transiently over-report and a request that would have fit
      // can be denied. This self-heals on the next call; we accept it rather than move
      // to a Lua script, which would gate all AI on an unverified atomic path.
      const newTotal = await redis.incrby(redisKey, charCount);
        const ttl = await redis.ttl(redisKey);
        if (ttl < 0) {
                await redis.expire(redisKey, secondsUntilMidnightKST());
        }

      if (newTotal > limit) {
              // Rollback and deny
              await redis.decrby(redisKey, charCount);
              return {
                        allowed: false,
                        usedChars: newTotal - charCount,
                        limitChars: limit,
                        usedPercent: Math.min(100, Math.round(((newTotal - charCount) / limit) * 100)),
              };
      }

      return {
              allowed: true,
              usedChars: newTotal,
              limitChars: limit,
              usedPercent: Math.round((newTotal / limit) * 100),
      };
  } catch (error) {
        console.error('Daily quota Redis error:', error);
        return { allowed: true, usedChars: 0, limitChars: limit, usedPercent: 0 };
  }
}

