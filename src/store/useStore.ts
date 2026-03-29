import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PageTextContent, SearchResult, HighlightSpan, EmbeddingProgress, TranslationErrorCode, ExtractedTextItem } from '@/lib/types';
import { exactSearch } from '@/lib/searchEngine';

interface SentenceChunk {
  text: string;
  page: number;
  primaryItem: ExtractedTextItem;
  items: ExtractedTextItem[];
}

/** Merge consecutive PDF.js text items into sentence-level chunks for semantic embedding. */
function buildSentenceChunks(pageContents: PageTextContent[]): SentenceChunk[] {
  const chunks: SentenceChunk[] = [];
  for (const page of pageContents) {
    if (page.items.length === 0) continue;
    let accText = '';
    let accItems: ExtractedTextItem[] = [];
    for (const item of page.items) {
      accText += (accText ? ' ' : '') + item.text;
      accItems.push(item);
      // Split on sentence-ending punctuation, but skip common abbreviations
      const endsWithPunct = /[.!?。！？:;]\s*$/.test(item.text);
      const isAbbreviation = /\b(?:e\.g|i\.e|et\s*al|Fig|Eq|Dr|Mr|Mrs|vs|etc|vol|no|pp)\.\s*$/i.test(accText);
      if ((endsWithPunct && !isAbbreviation) || accText.length > 200) {
        if (accText.trim().length >= 5) {
          chunks.push({ text: accText.trim(), page: page.page, primaryItem: accItems[0], items: accItems });
        }
        accText = '';
        accItems = [];
      }
    }
    if (accText.trim().length >= 5) {
      chunks.push({ text: accText.trim(), page: page.page, primaryItem: accItems[0], items: accItems });
    }
  }
  return chunks;
}

/** Show toast notification (lazy import to avoid circular deps) */
function showToastSafe(text: string, type: 'success' | 'error' | 'info' = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paperlens-toast', { detail: { text, type } }));
  }
}

let translateAbortController: AbortController | null = null;
let semanticAbortController: AbortController | null = null;
const quotaTimerMap: Record<string, ReturnType<typeof setTimeout>> = {};
let progressiveSearchTimer: ReturnType<typeof setTimeout> | null = null;

function clearQuotaTimers() {
  for (const key of Object.keys(quotaTimerMap)) {
    clearTimeout(quotaTimerMap[key]);
    delete quotaTimerMap[key];
  }
}

function scheduleQuotaReset(get: () => AppState, set: (s: Partial<AppState>) => void, type: 'embed' | 'translate') {
  // Only create a timer if one isn't already running — prevents infinite extension from rapid 429s
  if (quotaTimerMap[type]) return;

  const retryKey = type === 'embed' ? 'embedRetryAt' : 'translateRetryAt';
  set({ [retryKey]: Date.now() + 60000 });
  quotaTimerMap[type] = setTimeout(() => {
    delete quotaTimerMap[type];
    if (type === 'embed') {
      const cur = get().embedQuota;
      if (cur && cur.remaining <= 0) set({ embedQuota: { ...cur, remaining: cur.limit } });
    } else {
      const cur = get().translateQuota;
      if (cur && cur.remaining <= 0) set({ translateQuota: { ...cur, remaining: cur.limit } });
    }
    set({ [retryKey]: null });
  }, 60000);
}

const API_TIMEOUT_MS = 30000;

/** Semantic search similarity thresholds */
const SEMANTIC_THRESHOLD = 0.65;
const SEMANTIC_MIN_SCORE = 0.5;
const SEMANTIC_TOP_K = 10;

/** Return UTC date string (YYYY-MM-DD) to match server-side todayUTC() in rateLimit.ts. */
function getUTCDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Wrap fetch with a per-request timeout. Throws 'TIMEOUT' error on timeout. */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const externalSignal = init.signal;
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, API_TIMEOUT_MS);

  if (externalSignal) {
    if (externalSignal.aborted) { clearTimeout(timer); controller.abort(); }
    else externalSignal.addEventListener('abort', () => { clearTimeout(timer); controller.abort(); }, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (timedOut) {
      const timeoutErr = new Error('TIMEOUT');
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Pre-compute L2 norms for an array of embedding vectors */
function computeNorms(embeddings: number[][]): number[] {
  return embeddings.map((emb) => {
    let sum = 0;
    for (let i = 0; i < emb.length; i++) sum += emb[i] * emb[i];
    return Math.sqrt(sum);
  });
}

interface AppState {
  pdfFile: File | null;
  pdfData: Uint8Array | null;
  totalPages: number;
  currentPage: number;
  scale: number;
  pageTextContents: PageTextContent[];
  isLoadingPdf: boolean;
  isExtracting: boolean;

  searchQuery: string;
  searchMode: 'exact' | 'semantic';
  searchResults: SearchResult[];
  currentResultIndex: number;
  caseSensitive: boolean;

  sentenceEmbeddings: number[][] | null;
  sentenceNorms: number[] | null;
  sentenceChunks: SentenceChunk[] | null;
  isEmbedding: boolean;
  isSearching: boolean;
  pendingSemanticRetry: boolean;
  embeddingProgress: EmbeddingProgress | null;
  lastSearchedQuery: string;

  /** Per-mode cached results so switching modes doesn't lose previous results */
  cachedExactResults: { results: SearchResult[]; index: number; query: string };
  cachedSemanticResults: { results: SearchResult[]; index: number; query: string };

  selectedText: string;
  translationResult: string;
  isTranslating: boolean;
  isTranslationError: boolean;
  translationErrorCode: TranslationErrorCode | null;
  translationErrorDetail: string;
  showTranslation: boolean;

  translateQuota: { remaining: number; limit: number } | null;
  embedQuota: { remaining: number; limit: number } | null;
  embedRetryAt: number | null;
  translateRetryAt: number | null;
  dailyUsage: { translate: number; embed: number; date: string };

  viewerMode: 'scroll' | 'page';

  hasSeenTutorial: boolean;
  isGuideActive: boolean;
  tutorialStep: number;
  isSidebarOpen: boolean;

  setPdfFile: (file: File | null) => void;
  setPdfData: (data: Uint8Array | null) => void;
  setTotalPages: (n: number) => void;
  setCurrentPage: (n: number) => void;
  setScale: (s: number) => void;
  setPageTextContents: (contents: PageTextContent[]) => void;
  setIsLoadingPdf: (v: boolean) => void;
  setIsExtracting: (v: boolean) => void;

  setSearchQuery: (q: string) => void;
  setSearchMode: (mode: 'exact' | 'semantic') => void;
  setCaseSensitive: (v: boolean) => void;
  search: () => void;
  clearSearch: () => void;
  nextResult: () => void;
  prevResult: () => void;
  goToResult: (index: number) => void;

  setSelectedText: (text: string) => void;
  setShowTranslation: (v: boolean) => void;
  translate: (text: string) => Promise<void>;
  updateQuotaFromHeaders: (type: 'translate' | 'embed', headers: Headers) => void;
  incrementDailyUsage: (type: 'translate' | 'embed') => void;
  getDailyUsage: (type: 'translate' | 'embed') => number;

  setViewerMode: (mode: 'scroll' | 'page') => void;
  toggleViewerMode: () => void;

  startGuide: () => void;
  nextGuideStep: (totalSteps?: number) => void;
  skipGuide: () => void;
  setIsSidebarOpen: (v: boolean) => void;

  reset: () => void;
}

const initialState = {
  pdfFile: null,
  pdfData: null,
  totalPages: 0,
  currentPage: 1,
  scale: 1.5,
  pageTextContents: [],
  isLoadingPdf: false,
  isExtracting: false,
  searchQuery: '',
  searchMode: 'exact' as const,
  searchResults: [],
  currentResultIndex: -1,
  caseSensitive: false,
  sentenceEmbeddings: null,
  sentenceNorms: null,
  sentenceChunks: null,
  isEmbedding: false,
  isSearching: false,
  pendingSemanticRetry: false,
  embeddingProgress: null,
  lastSearchedQuery: '',
  cachedExactResults: { results: [], index: -1, query: '' },
  cachedSemanticResults: { results: [], index: -1, query: '' },
  selectedText: '',
  translationResult: '',
  isTranslating: false,
  isTranslationError: false,
  translationErrorCode: null,
  translationErrorDetail: '',
  showTranslation: false,
  translateQuota: null,
  embedQuota: null,
  embedRetryAt: null,
  translateRetryAt: null,
  dailyUsage: { translate: 0, embed: 0, date: '' },
  viewerMode: 'scroll' as const,
  hasSeenTutorial: false,
  isGuideActive: false,
  tutorialStep: 0,
  isSidebarOpen: false,
};

const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setPdfFile: (file) => set({ pdfFile: file }),
      setPdfData: (data) => {
        // Clear document-dependent state when PDF changes
        if (semanticAbortController) { semanticAbortController.abort(); semanticAbortController = null; }
        if (translateAbortController) { translateAbortController.abort(); translateAbortController = null; }
        clearQuotaTimers();
        if (progressiveSearchTimer) { clearTimeout(progressiveSearchTimer); progressiveSearchTimer = null; }
        set({
          pdfData: data,
          currentPage: 1,
          totalPages: 0,
          scale: 1.5,
          pageTextContents: [],
          searchResults: [],
          currentResultIndex: -1,
          searchMode: 'exact' as const,
          sentenceEmbeddings: null,
          sentenceNorms: null,
          sentenceChunks: null,
          isExtracting: false,
          isEmbedding: false,
          isSearching: false,
          isTranslating: false,
          isLoadingPdf: false,
          embeddingProgress: null,
          pendingSemanticRetry: false,
          lastSearchedQuery: '',
          showTranslation: false,
          selectedText: '',
          translationResult: '',
          translationErrorCode: null,
          translationErrorDetail: '',
        });
      },
      setTotalPages: (n) => set({ totalPages: n }),
      setCurrentPage: (n) => {
        const { totalPages } = get();
        if (n >= 1 && n <= totalPages) set({ currentPage: n });
      },
      setScale: (s) => set({ scale: Math.max(0.5, Math.min(3, s)) }),
      setPageTextContents: (contents) => {
        // During extraction, pages are appended — old embeddings stay valid (resume handles the rest).
        // Only fully invalidate embeddings on new document load (when not extracting).
        const { isExtracting, searchQuery, searchMode, pendingSemanticRetry, totalPages } = get();
        if (isExtracting) {
          set({ pageTextContents: contents, sentenceChunks: null });
        } else {
          set({ pageTextContents: contents, sentenceEmbeddings: null, sentenceNorms: null, sentenceChunks: null });
        }
        // Live-update WAIT_EXTRACTION progress so progress bar doesn't appear frozen
        if (pendingSemanticRetry && isExtracting) {
          set({ embeddingProgress: { code: 'WAIT_EXTRACTION', current: contents.length, total: totalPages } });
        }
        // Debounced progressive search: avoids O(N²) re-search on every batch during extraction
        if (searchQuery.trim() && searchMode === 'exact') {
          if (progressiveSearchTimer) clearTimeout(progressiveSearchTimer);
          progressiveSearchTimer = setTimeout(() => {
            progressiveSearchTimer = null;
            get().search();
          }, 500);
        }
      },
      setIsLoadingPdf: (v) => set({ isLoadingPdf: v }),
      setIsExtracting: (v) => {
        set({ isExtracting: v });
        // When extraction finishes, auto-trigger pending search
        if (!v) {
          const { searchQuery, searchMode } = get();
          if (searchQuery.trim()) {
            if (searchMode === 'exact') {
              setTimeout(() => get().search(), 0);
            } else if (searchMode === 'semantic' && get().pendingSemanticRetry) {
              set({ pendingSemanticRetry: false });
              setTimeout(() => get().search(), 100);
            }
          }
        }
      },

      setSearchQuery: (q) => set({ searchQuery: q, pendingSemanticRetry: false }),
      setSearchMode: (mode) => {
        const { searchMode: prevMode, searchResults, currentResultIndex, lastSearchedQuery } = get();
        if (mode === prevMode) return;
        if (semanticAbortController) { semanticAbortController.abort(); semanticAbortController = null; }
        // Cache current mode's results (keyed by the actually-searched query, not live input)
        const cacheKey = prevMode === 'exact' ? 'cachedExactResults' : 'cachedSemanticResults';
        const restoreKey = mode === 'exact' ? 'cachedExactResults' : 'cachedSemanticResults';
        const restored = get()[restoreKey];
        const queryMatches = restored.query === lastSearchedQuery;
        set({
          [cacheKey]: { results: searchResults, index: currentResultIndex, query: lastSearchedQuery },
          searchMode: mode,
          searchResults: queryMatches ? restored.results : [],
          currentResultIndex: queryMatches ? restored.index : -1,
          isEmbedding: false,
          isSearching: false,
          embeddingProgress: null,
          pendingSemanticRetry: false,
        });
        // Auto-trigger search if query exists but no cached results to restore
        const q = get().searchQuery.trim();
        if (q && get().searchResults.length === 0) {
          setTimeout(() => get().search(), 0);
        }
      },
      setCaseSensitive: (v) => {
        set({ caseSensitive: v });
        const { searchQuery, searchMode } = get();
        if (searchQuery.trim() && searchMode === 'exact') {
          setTimeout(() => get().search(), 0);
        }
      },

      search: () => {
        const { pageTextContents, searchQuery, searchMode, caseSensitive, isExtracting } = get();
        const query = searchQuery.trim();
        if (!query) {
          set({ searchResults: [], currentResultIndex: -1 });
          return;
        }

        if (searchMode === 'exact') {
          // Yield to main thread before heavy search to prevent UI freezing on large documents
          set({ isSearching: true });
          setTimeout(() => {
            const results = exactSearch(pageTextContents, query, caseSensitive);
            const prevIndex = get().currentResultIndex;
            const prevResults = get().searchResults;
            const isReSearch = prevResults.length > 0 && query === get().lastSearchedQuery;
            const newIndex = isReSearch && prevIndex >= 0 && prevIndex < results.length
              ? prevIndex
              : results.length > 0 ? 0 : -1;
            set({ searchResults: results, currentResultIndex: newIndex, lastSearchedQuery: query, isSearching: false });
            if (results.length > 0 && !isReSearch) {
              set({ currentPage: results[0].page });
              if (typeof window !== 'undefined' && window.innerWidth < 1024) set({ isSidebarOpen: true });
            }
          }, 0);
        } else if (searchMode === 'semantic') {
          // Block semantic search while still extracting text
          if (isExtracting) {
            const extractedPages = pageTextContents.length;
            const total = get().totalPages;
            set({ pendingSemanticRetry: true, embeddingProgress: { code: 'WAIT_EXTRACTION', current: extractedPages, total } });
            return;
          }

          // Quota pre-check: trust server headers when available, fall back to local counter
          const LOCAL_EMBED_LIMIT = 20;
          const embedQ = get().embedQuota;
          if (!get().sentenceEmbeddings) {
            if (embedQ) {
              // Server quota available — trust it over local counter (prevents ghost quota after server reset)
              if (embedQ.remaining <= 0) {
                set({ embeddingProgress: { code: 'EMBED_QUOTA_EXCEEDED' } });
                return;
              }
            } else {
              // No server data yet — fall back to local daily counter
              const localEmbedUsage = get().getDailyUsage('embed');
              if (localEmbedUsage >= LOCAL_EMBED_LIMIT) {
                set({ embeddingProgress: { code: 'EMBED_QUOTA_EXCEEDED' } });
                return;
              }
            }
          }

          if (semanticAbortController) { semanticAbortController.abort(); }
          const semController = new AbortController();
          semanticAbortController = semController;
          const signal = semController.signal;
          set({ isSearching: true });

          (async () => {
            try {
              // Build sentence-level chunks for semantic accuracy
              let chunks = get().sentenceChunks;
              if (!chunks) {
                chunks = buildSentenceChunks(pageTextContents);
                set({ sentenceChunks: chunks });
              }
              const meaningfulChunks = chunks.filter((c) => c.text.trim().length >= 5);

              if (meaningfulChunks.length === 0) {
                set({ searchResults: [], currentResultIndex: -1 });
                return;
              }

              // Generate embeddings if not cached (or resume from partial)
              let embeddings = get().sentenceEmbeddings;
              let norms = get().sentenceNorms;
              const needsMore = embeddings && embeddings.length < meaningfulChunks.length;
              if (!embeddings || needsMore) {
                set({ isEmbedding: true });
                const texts = meaningfulChunks.map((c) => c.text);
                const BATCH_SIZE = 50;
                const MAX_RETRIES = 2;
                // Resume from partial embeddings if available
                const allEmbeddings: number[][] = embeddings ? [...embeddings] : [];
                const startIdx = allEmbeddings.length;

                for (let i = startIdx; i < texts.length; i += BATCH_SIZE) {
                  if (signal.aborted) throw Object.assign(new Error('AbortError'), { name: 'AbortError', _partialEmbeddings: allEmbeddings });
                  const batch = texts.slice(i, i + BATCH_SIZE);
                  const progress = Math.min(i + BATCH_SIZE, texts.length);
                  set({ embeddingProgress: { code: 'ANALYZING', current: progress, total: texts.length } });

                  let batchResult: number[][] | null = null;
                  for (let retry = 0; retry <= MAX_RETRIES; retry++) {
                    try {
                      const res = await fetchWithTimeout('/api/embed', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ texts: batch }),
                        signal,
                      });
                      get().updateQuotaFromHeaders('embed', res.headers);
                      if (res.status === 429) {
                        const eq = get().embedQuota;
                        set({ embedQuota: eq ? { ...eq, remaining: 0 } : { remaining: 0, limit: 20 } });
                        scheduleQuotaReset(get, set, 'embed');
                        const errData = await res.json().catch(() => ({}));
                        set({ isEmbedding: false, embeddingProgress: { code: 'RATE_LIMITED', detail: errData.error }, searchResults: [], currentResultIndex: -1 });
                        showToastSafe(errData.error || '일일 AI 검색 사용 한도를 초과했습니다.', 'error');
                        return;
                      }
                      if (!res.ok) {
                        if (retry === MAX_RETRIES) {
                          set({ isEmbedding: false, embeddingProgress: { code: 'API_ERROR', detail: String(res.status) }, searchResults: [], currentResultIndex: -1 });
                          return;
                        }
                        await new Promise((r) => setTimeout(r, 1000 * (retry + 1)));
                        continue;
                      }
                      const data = await res.json();
                      if (data.error) {
                        if (retry === MAX_RETRIES) {
                          set({ isEmbedding: false, embeddingProgress: { code: 'EMBED_FAILED', detail: data.error }, searchResults: [], currentResultIndex: -1 });
                          return;
                        }
                        continue;
                      }
                      batchResult = data.embeddings;
                      break;
                    } catch (err: unknown) {
                      if (err instanceof Error && err.name === 'AbortError') throw Object.assign(new Error('AbortError'), { name: 'AbortError', _partialEmbeddings: allEmbeddings });
                      if (err instanceof Error && err.name === 'TimeoutError') {
                        if (retry === MAX_RETRIES) {
                          set({ isEmbedding: false, embeddingProgress: { code: 'TIMEOUT' }, searchResults: [], currentResultIndex: -1 });
                          return;
                        }
                        continue;
                      }
                      if (retry === MAX_RETRIES) throw err;
                      await new Promise((r) => setTimeout(r, 1000 * (retry + 1)));
                    }
                  }
                  if (batchResult) allEmbeddings.push(...batchResult);
                }

                if (signal.aborted) {
                  if (allEmbeddings.length > 0) set({ sentenceEmbeddings: allEmbeddings, sentenceNorms: computeNorms(allEmbeddings), isEmbedding: false });
                  return;
                }
                embeddings = allEmbeddings;
                norms = computeNorms(embeddings);
                set({ sentenceEmbeddings: embeddings, sentenceNorms: norms, isEmbedding: false });
                get().incrementDailyUsage('embed');
              }

              if (!embeddings) return;

              // Embed the keyword (server-side rate limit handles abuse; local limit only guards expensive doc embedding)
              set({ embeddingProgress: { code: 'COMPARING_KEYWORD' } });
              const kwRes = await fetchWithTimeout('/api/embed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts: [query] }),
                signal,
              });
              get().updateQuotaFromHeaders('embed', kwRes.headers);
              if (kwRes.status === 429) {
                const eq = get().embedQuota;
                set({ embedQuota: eq ? { ...eq, remaining: 0 } : { remaining: 0, limit: 20 } });
                scheduleQuotaReset(get, set, 'embed');
                set({ embeddingProgress: { code: 'RATE_LIMITED' }, searchResults: [], currentResultIndex: -1 });
                showToastSafe('일일 AI 검색 사용 한도를 초과했습니다.', 'error');
                return;
              }
              if (!kwRes.ok) { set({ embeddingProgress: { code: 'API_ERROR', detail: String(kwRes.status) }, searchResults: [], currentResultIndex: -1 }); return; }
              const kwData = await kwRes.json();
              if (kwData.error || !kwData.embeddings?.[0]) {
                set({ embeddingProgress: { code: 'EMBED_FAILED', detail: kwData.error }, searchResults: [], currentResultIndex: -1 });
                return;
              }

              if (signal.aborted) return;

              const kwEmb = kwData.embeddings[0];

              // Keyword norm (computed once)
              let kwNorm = 0;
              for (let j = 0; j < kwEmb.length; j++) kwNorm += kwEmb[j] * kwEmb[j];
              kwNorm = Math.sqrt(kwNorm);

              // Use pre-computed sentence norms (no redundant sqrt per item)
              // Score only chunks we have embeddings for (handles partial cache)
              const cachedNorms = norms || get().sentenceNorms;
              const scorableChunks = meaningfulChunks.slice(0, embeddings!.length);
              const allScored = scorableChunks
                .map((chunk, i) => {
                  const emb = embeddings![i];
                  let dot = 0;
                  for (let j = 0; j < emb.length; j++) dot += kwEmb[j] * emb[j];
                  const embNorm = cachedNorms ? cachedNorms[i] : 1;
                  const denom = kwNorm * embNorm;
                  return { chunk, score: denom === 0 ? 0 : dot / denom };
                })
                .sort((a, b) => b.score - a.score);

              // Adaptive threshold: use the static threshold, but if the top score
              // is well above it, tighten to reduce noise (top score * 0.75)
              const topScore = allScored.length > 0 ? allScored[0].score : 0;
              const adaptiveThreshold = Math.max(SEMANTIC_THRESHOLD, topScore * 0.75);

              let scored = allScored.filter((s) => s.score > adaptiveThreshold);
              let isFallback = false;
              if (scored.length === 0) {
                scored = allScored.filter((s) => s.score > SEMANTIC_MIN_SCORE).slice(0, SEMANTIC_TOP_K);
                isFallback = scored.length > 0;
              }

              const results: SearchResult[] = scored.map((s, idx) => {
                const primaryItem = s.chunk.primaryItem;

                // Generate highlight spans covering ALL items in the chunk
                // so the entire matched sentence is highlighted, not just one fragment
                const spans: HighlightSpan[] = s.chunk.items.map((chunkItem) => ({
                  itemIndex: chunkItem.itemIndex,
                  charStart: 0,
                  charEnd: chunkItem.text.length,
                }));

                return {
                  id: `sem-${primaryItem.page}-${primaryItem.itemIndex}-${idx}`,
                  page: primaryItem.page,
                  matchedToken: query,
                  context: s.chunk.text,
                  itemIndex: primaryItem.itemIndex,
                  charStart: 0,
                  charEnd: primaryItem.text.length,
                  spans,
                  semantic: true,
                };
              });

              if (signal.aborted) return;
              set({
                searchResults: results,
                currentResultIndex: results.length > 0 ? 0 : -1,
                lastSearchedQuery: query,
                embeddingProgress: results.length === 0
                  ? { code: 'NO_RESULTS' }
                  : isFallback
                    ? { code: 'FALLBACK_RESULTS' }
                    : null,
              });
              if (results.length > 0) {
                set({ currentPage: results[0].page });
                if (typeof window !== 'undefined' && window.innerWidth < 1024) set({ isSidebarOpen: true });
              }
            } catch (err: unknown) {
              if (err instanceof Error && err.name === 'AbortError') {
                // Save partial embeddings so next search resumes instead of restarting
                const partial = (err as Error & { _partialEmbeddings?: number[][] })._partialEmbeddings;
                if (partial && partial.length > 0) {
                  set({ sentenceEmbeddings: partial, sentenceNorms: computeNorms(partial), isEmbedding: false });
                }
                return;
              }
              if (err instanceof Error && err.name === 'TimeoutError') {
                set({ isEmbedding: false, embeddingProgress: { code: 'TIMEOUT' }, searchResults: [], currentResultIndex: -1 });
                return;
              }
              set({ isEmbedding: false, embeddingProgress: { code: 'NETWORK_ERROR' }, searchResults: [], currentResultIndex: -1 });
            } finally {
              if (semanticAbortController === semController) {
                semanticAbortController = null;
                set({ isSearching: false });
              }
            }
          })();
        }
      },

      clearSearch: () => {
        if (semanticAbortController) { semanticAbortController.abort(); semanticAbortController = null; }
        set({ searchQuery: '', lastSearchedQuery: '', searchResults: [], currentResultIndex: -1, embeddingProgress: null, isEmbedding: false, isSearching: false, pendingSemanticRetry: false });
      },

      nextResult: () => {
        const { searchResults, currentResultIndex } = get();
        if (searchResults.length === 0) return;
        const next = (currentResultIndex + 1) % searchResults.length;
        set({ currentResultIndex: next, currentPage: searchResults[next].page });
      },

      prevResult: () => {
        const { searchResults, currentResultIndex } = get();
        if (searchResults.length === 0) return;
        const prev = currentResultIndex <= 0 ? searchResults.length - 1 : currentResultIndex - 1;
        set({ currentResultIndex: prev, currentPage: searchResults[prev].page });
      },

      goToResult: (index) => {
        const { searchResults } = get();
        if (index >= 0 && index < searchResults.length) {
          set({ currentResultIndex: index, currentPage: searchResults[index].page });
          // Auto-close sidebar on mobile so user sees the highlighted result
          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            set({ isSidebarOpen: false });
          }
        }
      },

      updateQuotaFromHeaders: (type, headers) => {
        const limit = parseInt(headers.get('X-RateLimit-Limit') || '', 10);
        const remaining = parseInt(headers.get('X-RateLimit-Remaining') || '', 10);
        if (!isNaN(limit) && !isNaN(remaining)) {
          if (type === 'translate') set({ translateQuota: { remaining, limit } });
          else set({ embedQuota: { remaining, limit } });
        }
      },

      incrementDailyUsage: (type) => {
        const today = getUTCDateString();
        const usage = get().dailyUsage;
        if (usage.date !== today) {
          set({ dailyUsage: { translate: type === 'translate' ? 1 : 0, embed: type === 'embed' ? 1 : 0, date: today } });
        } else {
          set({ dailyUsage: { ...usage, [type]: usage[type] + 1 } });
        }
      },

      getDailyUsage: (type) => {
        const today = getUTCDateString();
        const usage = get().dailyUsage;
        return usage.date === today ? usage[type] : 0;
      },

      setSelectedText: (text) => set({ selectedText: text }),

      setShowTranslation: (v) => {
        if (!v) {
          if (translateAbortController) { translateAbortController.abort(); translateAbortController = null; }
          set({ showTranslation: false, selectedText: '', isTranslating: false, isTranslationError: false });
        } else {
          set({ showTranslation: true });
        }
      },

      translate: async (text) => {
        if (!text.trim()) return;

        // Quota pre-check: trust server headers when available, fall back to local counter
        const LOCAL_TRANSLATE_LIMIT = 50;
        const quota = get().translateQuota;
        if (quota) {
          if (quota.remaining <= 0) {
            set({ selectedText: text, showTranslation: true, translationResult: '', isTranslationError: true, translationErrorCode: 'TRANSLATE_QUOTA_EXCEEDED', translationErrorDetail: '' });
            return;
          }
        } else {
          const localUsage = get().getDailyUsage('translate');
          if (localUsage >= LOCAL_TRANSLATE_LIMIT) {
            set({ selectedText: text, showTranslation: true, translationResult: '', isTranslationError: true, translationErrorCode: 'TRANSLATE_QUOTA_EXCEEDED', translationErrorDetail: '' });
            return;
          }
        }

        if (translateAbortController) translateAbortController.abort();
        const controller = new AbortController();
        translateAbortController = controller;

        set({ isTranslating: true, selectedText: text, showTranslation: true, translationResult: '', isTranslationError: false, translationErrorCode: null, translationErrorDetail: '' });

        try {
          const res = await fetchWithTimeout('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
            signal: controller.signal,
          });
          get().updateQuotaFromHeaders('translate', res.headers);
          if (res.status === 429) {
            set({ translateQuota: quota ? { ...quota, remaining: 0 } : { remaining: 0, limit: 50 } });
            scheduleQuotaReset(get, set, 'translate');
            const data = await res.json().catch(() => ({}));
            set({ translationResult: '', isTranslationError: true, translationErrorCode: 'RATE_LIMITED', translationErrorDetail: data.error || '' });
            showToastSafe(data.error || '일일 번역 사용 한도를 초과했습니다.', 'error');
            return;
          }
          if (!res.ok) { set({ translationResult: '', isTranslationError: true, translationErrorCode: 'SERVER_ERROR', translationErrorDetail: String(res.status) }); return; }
          const data = await res.json();
          if (data.error) {
            set({ translationResult: '', isTranslationError: true, translationErrorCode: 'API_ERROR', translationErrorDetail: data.error });
          } else {
            set({ translationResult: data.translation, isTranslationError: false });
            get().incrementDailyUsage('translate');
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return;
          if (err instanceof Error && err.name === 'TimeoutError') {
            set({ translationResult: '', isTranslationError: true, translationErrorCode: 'TIMEOUT', translationErrorDetail: '' });
            return;
          }
          set({ translationResult: '', isTranslationError: true, translationErrorCode: 'NETWORK_ERROR', translationErrorDetail: '' });
        } finally {
          if (translateAbortController === controller) {
            translateAbortController = null;
            set({ isTranslating: false });
          }
        }
      },

      setViewerMode: (mode) => set({ viewerMode: mode }),
      toggleViewerMode: () => set((s) => ({ viewerMode: s.viewerMode === 'scroll' ? 'page' : 'scroll' })),

      startGuide: () => set({ isGuideActive: true, tutorialStep: 0 }),

      nextGuideStep: (totalSteps?: number) => {
        const { tutorialStep } = get();
        const maxIndex = (totalSteps ?? 4) - 1;
        if (tutorialStep >= maxIndex) {
          set({ isGuideActive: false, hasSeenTutorial: true });
        } else {
          set({ tutorialStep: tutorialStep + 1 });
        }
      },

      skipGuide: () => set({ isGuideActive: false, hasSeenTutorial: true }),

      setIsSidebarOpen: (v) => set({ isSidebarOpen: v }),

      reset: () => {
        if (translateAbortController) { translateAbortController.abort(); translateAbortController = null; }
        if (semanticAbortController) { semanticAbortController.abort(); semanticAbortController = null; }
        clearQuotaTimers();
        const { hasSeenTutorial, dailyUsage, viewerMode } = get();
        set({ ...initialState, hasSeenTutorial, dailyUsage, viewerMode });
      },
    }),
    {
      name: 'paperlens-storage',
      partialize: (state: AppState) => ({
        hasSeenTutorial: state.hasSeenTutorial,
        dailyUsage: state.dailyUsage,
        viewerMode: state.viewerMode,
      }),
    }
  )
);

export default useStore;
