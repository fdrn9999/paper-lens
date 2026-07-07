import { searchAllTerms, type SearchTermSpec } from './searchEngine';
import type { PageTextContent, SearchResult } from './types';
import type { SearchWorkerResponse } from './searchWorker';

/**
 * Runs the document search off the main thread via a Web Worker, with a bulletproof
 * synchronous fallback (P-02). The worker and the fallback both call searchAllTerms,
 * so results are identical by construction. Any failure — worker unavailable, throws
 * on construction/postMessage, emits an error, or doesn't respond within the timeout —
 * falls back to running searchAllTerms on the main thread (i.e. the previous behavior).
 * That means the worker is a pure optimization and can never regress correctness.
 */

// Backstop only: the worker should respond in well under this. If it silently hangs,
// we fall back to a synchronous search rather than leaving the UI stuck.
const WORKER_TIMEOUT_MS = 15000;

let worker: Worker | null = null;
let workerDisabled = false;
let reqId = 0;

function getWorker(): Worker | null {
  if (workerDisabled) return null;
  if (worker) return worker;
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./searchWorker.ts', import.meta.url), { type: 'module' });
    return worker;
  } catch {
    workerDisabled = true;
    return null;
  }
}

function disableWorker() {
  workerDisabled = true;
  try {
    worker?.terminate();
  } catch {
    /* ignore */
  }
  worker = null;
}

export function runSearchTerms(
  pages: PageTextContent[],
  terms: SearchTermSpec[],
  caseSensitive: boolean,
): Promise<SearchResult[]> {
  const w = getWorker();
  // No worker: yield a tick before the synchronous search so the "searching" state can
  // paint, matching the previous setTimeout(…, 0) behavior.
  if (!w) return new Promise((resolve) => setTimeout(() => resolve(searchAllTerms(pages, terms, caseSensitive)), 0));

  return new Promise<SearchResult[]>((resolve) => {
    const id = ++reqId;
    let settled = false;

    const finish = (results: SearchResult[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      resolve(results);
    };

    const onMessage = (e: MessageEvent<SearchWorkerResponse>) => {
      if (e.data?.id === id) finish(e.data.results);
    };
    const onError = () => {
      disableWorker();
      finish(searchAllTerms(pages, terms, caseSensitive));
    };
    const timer = setTimeout(() => {
      finish(searchAllTerms(pages, terms, caseSensitive));
    }, WORKER_TIMEOUT_MS);

    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);

    try {
      w.postMessage({ id, pages, terms, caseSensitive });
    } catch {
      // e.g. a value that can't be structured-cloned — fall back synchronously.
      disableWorker();
      finish(searchAllTerms(pages, terms, caseSensitive));
    }
  });
}
