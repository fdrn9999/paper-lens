/**
 * Fetch helper for server → Gemini calls with an overall timeout and a bounded
 * retry on transient failures. Without this, a stalled Gemini request would hang
 * the serverless function until the platform hard-timeout (B-01), and a transient
 * 5xx/429 or network blip would surface immediately as an error (B-04).
 *
 * All retry attempts share a single deadline so the total wall time stays under
 * `timeoutMs` (kept below the client's own fetch timeout so the client sees a
 * clean 504 rather than its own abort). The Gemini quota is charged by the caller
 * once before this runs, so retrying here never double-charges.
 */

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

/** Thrown when the overall deadline elapses before a response is received. */
export class GeminiTimeoutError extends Error {
  constructor() {
    super('Gemini request timed out');
    this.name = 'GeminiTimeoutError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GeminiFetchOptions {
  /** Overall deadline for all attempts combined, in milliseconds. */
  timeoutMs: number;
  /** Number of retries after the first attempt (default 1 → up to 2 attempts). */
  retries?: number;
}

export async function fetchGeminiWithRetry(
  url: string,
  init: RequestInit,
  { timeoutMs, retries = 1 }: GeminiFetchOptions
): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      // Retry transient statuses while there is time and budget left.
      if (TRANSIENT_STATUS.has(res.status) && attempt < retries && deadline - Date.now() > 1000) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      // Our own timeout fired → deadline exceeded, stop retrying.
      if (controller.signal.aborted) break;
      // Network-level error: retry if time and budget remain.
      if (attempt < retries && deadline - Date.now() > 1000) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      break;
    }
  }

  // Preserve a real network error for logging; otherwise report a timeout.
  if (lastError instanceof Error && lastError.name !== 'AbortError') throw lastError;
  throw new GeminiTimeoutError();
}
