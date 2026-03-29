import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, checkDailyQuota, checkGlobalQuota, getClientIp } from '@/lib/rateLimit';
import { getGeminiApiKey } from '@/lib/env';

const BATCH_SIZE = 100;
const MAX_TEXTS = 300;
const MAX_TEXT_LENGTH = 5000;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { allowed, retryAfterMs } = checkRateLimit(`embed:${ip}`);
    if (!allowed) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
        }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: '잘못된 JSON 형식입니다.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.' },
        { status: 400 }
      );
    }

    const { texts } = body as { texts: unknown };

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: 'texts 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    if (texts.length > MAX_TEXTS) {
      return NextResponse.json(
        { error: `텍스트 배열이 너무 큽니다. (최대 ${MAX_TEXTS}개)` },
        { status: 400 }
      );
    }

    let totalChars = 0;
    for (let i = 0; i < texts.length; i++) {
      if (typeof texts[i] !== 'string') {
        return NextResponse.json(
          { error: `texts[${i}]이(가) 문자열이 아닙니다.` },
          { status: 400 }
        );
      }
      if (texts[i].trim().length === 0) {
        return NextResponse.json(
          { error: `texts[${i}]이(가) 비어있습니다.` },
          { status: 400 }
        );
      }
      if (texts[i].length > MAX_TEXT_LENGTH) {
        return NextResponse.json(
          { error: `texts[${i}]이(가) 너무 깁니다. (최대 ${MAX_TEXT_LENGTH}자)` },
          { status: 400 }
        );
      }
      totalChars += texts[i].length;
    }

    // Global budget check (character-based)
    const globalQuota = checkGlobalQuota('embed', totalChars);
    if (!globalQuota.allowed) {
      return NextResponse.json(
        { error: '서비스 사용량이 많아 일시적으로 AI 검색이 제한됩니다. 내일 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    // Per-IP daily quota check (character-based)
    const quota = checkDailyQuota('embed', ip, totalChars);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `오늘의 AI 검색 사용량을 초과했습니다. (${quota.usedPercent}% 사용)` },
        {
          status: 429,
          headers: {
            'X-Quota-Used-Chars': String(quota.usedChars),
            'X-Quota-Limit-Chars': String(quota.limitChars),
            'X-Quota-Used-Percent': String(quota.usedPercent),
          },
        }
      );
    }

    let apiKey: string;
    try {
      apiKey = getGeminiApiKey();
    } catch {
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const trimmedTexts = (texts as string[]).map((t) => t.trim());
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < trimmedTexts.length; i += BATCH_SIZE) {
      const batch = trimmedTexts.slice(i, i + BATCH_SIZE);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: batch.map((text: string) => ({
              model: 'models/gemini-embedding-001',
              content: { parts: [{ text }] },
            })),
          }),
        }
      );

      if (!response.ok) {
        await response.json().catch(() => null);
        return NextResponse.json(
          { error: `Embedding API 오류 (${response.status})` },
          { status: 502 }
        );
      }

      const data = await response.json();
      const embeddings = data.embeddings?.map((e: { values: number[] }) => e.values) || [];
      allEmbeddings.push(...embeddings);
    }

    return NextResponse.json({ embeddings: allEmbeddings }, {
      headers: {
        'X-Quota-Used-Chars': String(quota.usedChars),
        'X-Quota-Limit-Chars': String(quota.limitChars),
        'X-Quota-Used-Percent': String(quota.usedPercent),
      },
    });
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
