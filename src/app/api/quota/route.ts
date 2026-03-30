import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, DAILY_CHAR_LIMITS } from '@/lib/rateLimit';
import { Redis } from '@upstash/redis';

function getRedis(): Redis {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN must be set');
  return new Redis({ url, token });
}

function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const redis = getRedis();
    const today = todayKST();

    const [translateUsed, chatUsed] = await Promise.all([
      redis.get<number>(`dq:translate:${ip}:${today}`),
      redis.get<number>(`dq:chat:${ip}:${today}`),
    ]);

    const translateLimit = DAILY_CHAR_LIMITS.translate ?? 50000;
    const chatLimit = DAILY_CHAR_LIMITS.chat ?? 100000;

    const tUsed = translateUsed || 0;
    const cUsed = chatUsed || 0;

    return NextResponse.json({
      translate: {
        usedChars: tUsed,
        limitChars: translateLimit,
        usedPercent: Math.min(100, Math.round((tUsed / translateLimit) * 100)),
      },
      chat: {
        usedChars: cUsed,
        limitChars: chatLimit,
        usedPercent: Math.min(100, Math.round((cUsed / chatLimit) * 100)),
      },
    });
  } catch {
    return NextResponse.json(
      { translate: null, chat: null },
      { status: 200 }
    );
  }
}
