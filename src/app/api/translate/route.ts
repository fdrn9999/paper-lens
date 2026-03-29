import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, checkDailyQuota, checkGlobalQuota, getClientIp } from '@/lib/rateLimit';
import { getGeminiApiKey } from '@/lib/env';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { allowed, retryAfterMs } = checkRateLimit(`translate:${ip}`);
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

    const { text } = body as { text: unknown };

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '번역할 텍스트가 필요합니다.' },
        { status: 400 }
      );
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return NextResponse.json(
        { error: '번역할 텍스트가 비어있습니다.' },
        { status: 400 }
      );
    }

    if (trimmed.length > 3000) {
      return NextResponse.json(
        { error: '텍스트가 너무 깁니다. (최대 3000자)' },
        { status: 400 }
      );
    }

    const charCount = trimmed.length;

    // Global budget check (character-based)
    const globalQuota = checkGlobalQuota('translate', charCount);
    if (!globalQuota.allowed) {
      return NextResponse.json(
        { error: '서비스 사용량이 많아 일시적으로 번역이 제한됩니다. 내일 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    // Per-IP daily quota check (character-based)
    const quota = checkDailyQuota('translate', ip, charCount);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `오늘의 번역 사용량을 초과했습니다. (${quota.usedPercent}% 사용)` },
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a professional academic translator. Translate the following English text into Korean.
Maintain academic tone and technical terms where appropriate.
Only return the translated text, nothing else.

Text to translate:
${trimmed}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      await response.json().catch(() => null);
      return NextResponse.json(
        { error: `Gemini API 오류 (${response.status})` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const translation =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '번역 결과를 받지 못했습니다.';

    return NextResponse.json({ translation }, {
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
