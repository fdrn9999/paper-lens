import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PageTextContent, SearchResult, HighlightSpan, EmbeddingProgress, TranslationErrorCode, ExtractedTextItem, ExtractedKeyword, KeywordAlgorithm, SearchTerm } from '@/lib/types';
import { exactSearch } from '@/lib/searchEngine';
// keywordExtractor is dynamically imported in extractAllKeywords to avoid circular deps

interface SentenceChunk {
  text: string;
  page: number;
  primaryItem: ExtractedTextItem;
  items: ExtractedTextItem[];
  isOverlap?: boolean;
}

const CHUNK_MIN = 300;
const CHUNK_MAX = 500;
const CHUNK_OVERLAP = 50;

const ABBREVIATION_RE = /\b(?:e\.g|i\.e|et\s*al|Fig|Eq|Dr|Mr|Mrs|Ms|Prof|vs|etc|vol|no|pp|approx|dept|est|inc|Jr|Sr|St|Ref|Ch|Sec)\.\s*$/i;
const SENTENCE_END_RE = /[.!?。！？]\s*$/;
const SECTION_HEADER_RE = /^(?:\d+\.?\s+[A-Z]|[A-Z][A-Z\s]{4,}$|Abstract|Introduction|Conclusion|References|Discussion|Methods|Results|Background|Related Work|Acknowledgment)/;

/** Detect if an item looks like a section header based on text pattern and font size. */
function isSectionHeader(item: ExtractedTextItem, avgHeight: number): boolean {
  const trimmed = item.text.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return false;
  if (SECTION_HEADER_RE.test(trimmed) && item.height > avgHeight * 1.1) return true;
  if (item.height > avgHeight * 1.4 && trimmed.length < 80) return true;
  return false;
}

/** Merge consecutive PDF.js text items into paragraph-level chunks with sliding window overlap. */
function buildSentenceChunks(pageContents: PageTextContent[]): SentenceChunk[] {
  // Phase 1: Build raw paragraph segments respecting section/paragraph boundaries
  const segments: { text: string; page: number; items: ExtractedTextItem[] }[] = [];

  for (const page of pageContents) {
    if (page.items.length === 0) continue;

    // Compute average item height for header detection
    let totalHeight = 0;
    for (const item of page.items) totalHeight += item.height;
    const avgHeight = totalHeight / page.items.length || 12;

    let accText = '';
    let accItems: ExtractedTextItem[] = [];

    const flushSegment = () => {
      const trimmed = accText.trim();
      if (trimmed.length >= 5) {
        segments.push({ text: trimmed, page: page.page, items: [...accItems] });
      }
      accText = '';
      accItems = [];
    };

    for (const item of page.items) {
      // Section header starts a new segment
      if (isSectionHeader(item, avgHeight) && accText.length > 0) {
        flushSegment();
      }

      // Detect paragraph breaks: large vertical gap between items
      if (accItems.length > 0) {
        const prevItem = accItems[accItems.length - 1];
        const prevY = prevItem.transform[5];
        const curY = item.transform[5];
        const lineGap = Math.abs(curY - prevY);
        // A gap > 1.8x the average height likely indicates a paragraph break
        if (lineGap > avgHeight * 1.8 && accText.length > 0) {
          flushSegment();
        }
      }

      accText += (accText ? ' ' : '') + item.text;
      accItems.push(item);

      // Sentence boundary check for segments hitting max size
      const endsWithPunct = SENTENCE_END_RE.test(item.text);
      const isAbbr = ABBREVIATION_RE.test(accText);

      if (accText.length >= CHUNK_MAX) {
        // Try to split at last sentence boundary within the accumulated text
        if (endsWithPunct && !isAbbr) {
          flushSegment();
        } else {
          // Force split at max — find last sentence end within accumulated text
          const lastSentEnd = accText.search(/[.!?。！？][^.!?。！？]*$/);
          if (lastSentEnd > CHUNK_MIN) {
            const splitPos = lastSentEnd + 1;
            const splitText = accText.slice(0, splitPos).trim();
            // Find the item boundary closest to splitPos
            let charCount = 0;
            let splitItemIdx = 0;
            for (let k = 0; k < accItems.length; k++) {
              if (k > 0) charCount += 1; // space separator between items
              charCount += accItems[k].text.length;
              if (charCount >= splitPos) { splitItemIdx = k + 1; break; }
            }
            if (splitItemIdx === 0) splitItemIdx = accItems.length;
            if (splitText.length >= 5) {
              segments.push({ text: splitText, page: page.page, items: accItems.slice(0, splitItemIdx) });
            }
            accText = accText.slice(splitPos).trim();
            accItems = accItems.slice(splitItemIdx);
          } else {
            flushSegment();
          }
        }
      } else if (endsWithPunct && !isAbbr && accText.length >= CHUNK_MIN) {
        flushSegment();
      }
    }

    flushSegment();
  }

  // Phase 2: Apply sliding window overlap to produce final chunks
  const chunks: SentenceChunk[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    chunks.push({
      text: seg.text,
      page: seg.page,
      primaryItem: seg.items[0],
      items: seg.items,
    });

    // Create overlap chunk between consecutive segments on the same page
    if (i + 1 < segments.length && segments[i + 1].page === seg.page) {
      const next = segments[i + 1];

      // Collect tail items by character count to match text slice
      const tailTarget = CHUNK_OVERLAP;
      let tailCharCount = 0;
      let tailStartIdx = seg.items.length;
      for (let k = seg.items.length - 1; k >= 0; k--) {
        tailCharCount += seg.items[k].text.length;
        tailStartIdx = k;
        if (tailCharCount >= tailTarget) break;
      }
      const tailItems = seg.items.slice(tailStartIdx);
      const tailText = tailItems.map((it) => it.text).join(' ');

      // Collect head items by character count
      let headCharCount = 0;
      let headEndIdx = 0;
      for (let k = 0; k < next.items.length; k++) {
        headCharCount += next.items[k].text.length;
        headEndIdx = k + 1;
        if (headCharCount >= CHUNK_OVERLAP) break;
      }
      const headItems = next.items.slice(0, headEndIdx);
      const headText = headItems.map((it) => it.text).join(' ');

      const overlapText = (tailText + ' ' + headText).trim();
      if (overlapText.length >= 20) {
        const overlapItems = [...tailItems, ...headItems];
        chunks.push({
          text: overlapText,
          page: seg.page,
          primaryItem: tailItems[0],
          items: overlapItems,
          isOverlap: true,
        });
      }
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

/** Detect if text is predominantly Korean (>30% Korean characters). */
function isKoreanText(text: string): boolean {
  const koreanRe = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g;
  const matches = text.match(koreanRe);
  const koreanChars = matches ? matches.length : 0;
  const totalChars = text.replace(/\s/g, '').length;
  return totalChars > 0 && koreanChars / totalChars > 0.3;
}

/** Search term color palette for multi-term exact search. */
const SEARCH_TERM_COLORS = [
  '#FFD500', '#FF6B6B', '#4ECDC4', '#A78BFA', '#FB923C',
  '#34D399', '#60A5FA', '#F472B6', '#FBBF24', '#818CF8',
];

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
    set({ [retryKey]: null });
  }, 60000);
}

const API_TIMEOUT_MS = 30000;

/** Semantic search similarity thresholds */
const SEMANTIC_MIN_SCORE = 0.4;
const SEMANTIC_TOP_K = 15;
const MMR_LAMBDA = 0.7;      // balance relevance vs diversity in MMR
const RRF_K = 60;            // constant for Reciprocal Rank Fusion

/** Compute adaptive threshold from score distribution (mean + 0.5 * stddev). */
function computeAdaptiveThreshold(scores: number[]): number {
  if (scores.length === 0) return 0.5;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);
  // Threshold = mean + 0.5*stddev, clamped to [0.4, 0.85]
  return Math.max(0.4, Math.min(0.85, mean + 0.5 * stddev));
}

/** MMR re-ranking: select results that are both relevant and diverse. */
function mmrRerank(
  candidates: { chunk: SentenceChunk; score: number; embIdx: number }[],
  embeddings: number[][],
  norms: number[],
  maxResults: number,
): { chunk: SentenceChunk; score: number; embIdx: number }[] {
  if (candidates.length <= 1) return candidates;
  const selected: typeof candidates = [];
  const remaining = [...candidates];

  // Always pick the top-scoring candidate first
  selected.push(remaining.shift()!);

  while (selected.length < maxResults && remaining.length > 0) {
    let bestIdx = 0;
    let bestMmr = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const rel = remaining[i].score;
      // Max similarity to any already-selected result
      let maxSim = 0;
      for (const sel of selected) {
        const eA = embeddings[remaining[i].embIdx];
        const eB = embeddings[sel.embIdx];
        const nA = norms[remaining[i].embIdx];
        const nB = norms[sel.embIdx];
        if (!eA || !eB) continue;
        let dot = 0;
        for (let j = 0; j < eA.length; j++) dot += eA[j] * eB[j];
        const sim = (nA * nB) === 0 ? 0 : dot / (nA * nB);
        if (sim > maxSim) maxSim = sim;
      }
      const mmr = MMR_LAMBDA * rel - (1 - MMR_LAMBDA) * maxSim;
      if (mmr > bestMmr) { bestMmr = mmr; bestIdx = i; }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected;
}

/** Reciprocal Rank Fusion: merge two ranked result lists by page+itemIndex key. */
function rrfMerge(
  semanticResults: SearchResult[],
  exactResults: SearchResult[],
): SearchResult[] {
  const scoreMap = new Map<string, { result: SearchResult; score: number }>();

  for (let i = 0; i < semanticResults.length; i++) {
    const r = semanticResults[i];
    const key = `${r.page}-${r.itemIndex}`;
    const rrfScore = 1 / (RRF_K + i + 1);
    const existing = scoreMap.get(key);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scoreMap.set(key, { result: r, score: rrfScore });
    }
  }

  for (let i = 0; i < exactResults.length; i++) {
    const r = exactResults[i];
    const key = `${r.page}-${r.itemIndex}`;
    const rrfScore = 1 / (RRF_K + i + 1);
    const existing = scoreMap.get(key);
    if (existing) {
      existing.score += rrfScore;
      // Both semantic and exact matched — keep wider spans (semantic) but add exact charStart/charEnd
      if (existing.result.semantic) {
        existing.result = { ...existing.result, charStart: r.charStart, charEnd: r.charEnd };
      }
    } else {
      // exact-only result — keep original semantic flag (false)
      scoreMap.set(key, { result: r, score: rrfScore });
    }
  }

  return [...scoreMap.values()]
    .sort((a, b) => b.score - a.score)
    .map((v) => v.result);
}

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

  translateQuota: { usedPercent: number; usedChars: number; limitChars: number } | null;
  embedQuota: { usedPercent: number; usedChars: number; limitChars: number } | null;
  embedRetryAt: number | null;
  translateRetryAt: number | null;
  dailyUsage: { translate: number; embed: number; date: string };

  searchTerms: SearchTerm[];

  keywords: ExtractedKeyword[] | null;
  keywordAlgorithm: KeywordAlgorithm;
  allKeywords: Record<string, ExtractedKeyword[]>;
  activeKeywords: string[];
  isExtractingKeywords: boolean;
  keywordProgress: { current: number; total: number } | null;
  sidebarTab: 'search' | 'keywords';

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
  incrementDailyUsage: (type: 'translate' | 'embed', charCount?: number) => void;
  getDailyUsage: (type: 'translate' | 'embed') => number;

  addSearchTerm: (term: string) => void;
  removeSearchTerm: (id: string) => void;
  clearSearchTerms: () => void;

  extractAllKeywords: () => void;
  setKeywordAlgorithm: (algo: KeywordAlgorithm) => void;
  toggleKeywordHighlight: (term: string) => void;
  clearKeywords: () => void;
  setSidebarTab: (tab: 'search' | 'keywords') => void;

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
  searchTerms: [] as SearchTerm[],
  keywords: null as ExtractedKeyword[] | null,
  keywordAlgorithm: 'tfidf' as KeywordAlgorithm,
  allKeywords: {} as Record<string, ExtractedKeyword[]>,
  activeKeywords: [] as string[],
  isExtractingKeywords: false,
  keywordProgress: null as { current: number; total: number } | null,
  sidebarTab: 'search' as 'search' | 'keywords',
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
          searchTerms: [],
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
          keywords: null,
          allKeywords: {},
          activeKeywords: [],
          isExtractingKeywords: false,
          keywordProgress: null,
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
        if ((searchQuery.trim() || get().searchTerms.length > 0) && searchMode === 'exact') {
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
        // When extraction finishes, auto-trigger pending search and keyword extraction
        if (!v) {
          const { searchQuery, searchMode, searchTerms } = get();
          if (searchQuery.trim() || searchTerms.length > 0) {
            if (searchMode === 'exact') {
              setTimeout(() => get().search(), 0);
            } else if (searchMode === 'semantic' && get().pendingSemanticRetry) {
              set({ pendingSemanticRetry: false });
              setTimeout(() => get().search(), 100);
            }
          }
          // Auto-extract keywords when text extraction completes
          if (get().pageTextContents.length > 0) {
            setTimeout(() => get().extractAllKeywords(), 200);
          }
        }
      },

      setSearchQuery: (q) => set({ searchQuery: q, pendingSemanticRetry: false }),
      setSearchMode: (mode) => {
        const { searchMode: prevMode, searchResults, currentResultIndex, lastSearchedQuery } = get();
        if (mode === prevMode) return;
        if (semanticAbortController) { semanticAbortController.abort(); semanticAbortController = null; }
        if (progressiveSearchTimer) { clearTimeout(progressiveSearchTimer); progressiveSearchTimer = null; }
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
        // Auto-trigger search if query/terms exist but no cached results to restore,
        // or when switching to exact mode with active search terms
        const q = get().searchQuery.trim();
        const terms = get().searchTerms;
        const shouldSearch = (q || terms.length > 0) &&
          (get().searchResults.length === 0 || (mode === 'exact' && terms.length > 0));
        if (shouldSearch) {
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
        const { pageTextContents, searchQuery, searchMode, caseSensitive, isExtracting, searchTerms } = get();

        if (searchMode === 'exact') {
          // Multi-term search: use searchTerms if available, fallback to searchQuery
          const terms = searchTerms.length > 0
            ? searchTerms
            : searchQuery.trim()
              ? [{ id: 'single', term: searchQuery.trim(), color: SEARCH_TERM_COLORS[0] }]
              : [];

          if (terms.length === 0) {
            set({ searchResults: [], currentResultIndex: -1 });
            return;
          }

          set({ isSearching: true });
          setTimeout(() => {
            const allResults: SearchResult[] = [];
            for (const st of terms) {
              const results = exactSearch(pageTextContents, st.term, caseSensitive);
              for (const r of results) {
                r.termColor = st.color;
                r.termLabel = st.term;
              }
              allResults.push(...results);
            }
            // Sort by page, then by position within page
            allResults.sort((a, b) => a.page - b.page || a.itemIndex - b.itemIndex);
            // Deduplicate overlapping results (same id from different terms)
            const seen = new Set<string>();
            const deduped = allResults.filter((r) => {
              const key = `${r.id}-${r.termLabel}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

            const termsKey = terms.map((t) => t.term).join(',');
            const prevIndex = get().currentResultIndex;
            const prevResults = get().searchResults;
            const isReSearch = prevResults.length > 0 && termsKey === get().lastSearchedQuery;
            const newIndex = isReSearch && prevIndex >= 0 && prevIndex < deduped.length
              ? prevIndex
              : deduped.length > 0 ? 0 : -1;
            set({ searchResults: deduped, currentResultIndex: newIndex, lastSearchedQuery: termsKey, isSearching: false });
            if (deduped.length > 0 && !isReSearch) {
              set({ currentPage: deduped[0].page });
              if (typeof window !== 'undefined' && window.innerWidth < 1024) set({ isSidebarOpen: true });
            }
          }, 0);
        } else if (searchMode === 'semantic') {
          const query = searchQuery.trim();
          if (!query) {
            set({ searchResults: [], currentResultIndex: -1 });
            return;
          }
          // Block semantic search while still extracting text
          if (isExtracting) {
            const extractedPages = pageTextContents.length;
            const total = get().totalPages;
            set({ pendingSemanticRetry: true, embeddingProgress: { code: 'WAIT_EXTRACTION', current: extractedPages, total } });
            return;
          }

          // Quota pre-check: if server reports 100% used, block
          const embedQ = get().embedQuota;
          if (!get().sentenceEmbeddings && embedQ && embedQ.usedPercent >= 100) {
            set({ embeddingProgress: { code: 'EMBED_QUOTA_EXCEEDED' } });
            return;
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
                        set({ embedQuota: { usedPercent: 100, usedChars: 0, limitChars: 0 } });
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
                set({ embedQuota: { usedPercent: 100, usedChars: 0, limitChars: 0 } });
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
                  return { chunk, score: denom === 0 ? 0 : dot / denom, embIdx: i };
                })
                .sort((a, b) => b.score - a.score);

              // Adaptive threshold based on score distribution
              const allScores = allScored.map((s) => s.score);
              const adaptiveThreshold = computeAdaptiveThreshold(allScores);

              let scored = allScored.filter((s) => s.score >= adaptiveThreshold);
              let isFallback = false;
              if (scored.length === 0) {
                scored = allScored.filter((s) => s.score > SEMANTIC_MIN_SCORE).slice(0, SEMANTIC_TOP_K);
                isFallback = scored.length > 0;
              }

              // Dedup: when a non-overlap chunk and its overlap both match, drop the overlap
              if (scored.length > 1) {
                const nonOverlapKeys = new Set(
                  scored.filter((s) => !s.chunk.isOverlap)
                    .map((s) => `${s.chunk.page}-${s.chunk.primaryItem.itemIndex}`)
                );
                scored = scored.filter((s) => {
                  if (!s.chunk.isOverlap) return true;
                  const key = `${s.chunk.page}-${s.chunk.primaryItem.itemIndex}`;
                  return !nonOverlapKeys.has(key);
                });
              }

              // MMR re-ranking for diversity (reduce redundant chunks)
              if (scored.length > 1 && embeddings && cachedNorms) {
                scored = mmrRerank(scored, embeddings, cachedNorms, SEMANTIC_TOP_K);
              }

              const semanticResults: SearchResult[] = scored.map((s, idx) => {
                const primaryItem = s.chunk.primaryItem;

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
                  relevanceScore: s.score,
                };
              });

              // Hybrid search: run exact search and merge via RRF
              const exactResults = exactSearch(pageTextContents, query, false);
              const results = exactResults.length > 0
                ? rrfMerge(semanticResults, exactResults).slice(0, SEMANTIC_TOP_K)
                : semanticResults;

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
        set({ searchQuery: '', lastSearchedQuery: '', searchResults: [], currentResultIndex: -1, embeddingProgress: null, isEmbedding: false, isSearching: false, pendingSemanticRetry: false, searchTerms: [] });
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
        const usedChars = parseInt(headers.get('X-Quota-Used-Chars') || '', 10);
        const limitChars = parseInt(headers.get('X-Quota-Limit-Chars') || '', 10);
        const usedPercent = parseInt(headers.get('X-Quota-Used-Percent') || '', 10);
        if (!isNaN(usedChars) && !isNaN(limitChars) && !isNaN(usedPercent)) {
          const quota = { usedPercent, usedChars, limitChars };
          if (type === 'translate') set({ translateQuota: quota });
          else set({ embedQuota: quota });
        }
      },

      incrementDailyUsage: (type, charCount = 1) => {
        const today = getUTCDateString();
        const usage = get().dailyUsage;
        if (usage.date !== today) {
          set({ dailyUsage: { translate: type === 'translate' ? charCount : 0, embed: type === 'embed' ? charCount : 0, date: today } });
        } else {
          set({ dailyUsage: { ...usage, [type]: usage[type] + charCount } });
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

        // Block Korean→Korean translation
        if (isKoreanText(text)) {
          set({
            selectedText: text,
            showTranslation: true,
            translationResult: '',
            isTranslating: false,
            isTranslationError: true,
            translationErrorCode: 'ALREADY_KOREAN',
            translationErrorDetail: '',
          });
          showToastSafe('이미 한국어 텍스트입니다.', 'info');
          return;
        }

        // Quota pre-check: if server reports 100% used, block
        const quota = get().translateQuota;
        if (quota && quota.usedPercent >= 100) {
          set({ selectedText: text, showTranslation: true, translationResult: '', isTranslationError: true, translationErrorCode: 'TRANSLATE_QUOTA_EXCEEDED', translationErrorDetail: '' });
          return;
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
            set({ translateQuota: { usedPercent: 100, usedChars: 0, limitChars: 0 } });
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

      addSearchTerm: (term) => {
        const trimmed = term.trim();
        if (!trimmed) return;
        const { searchTerms, caseSensitive } = get();
        // Don't add duplicates (respect case sensitivity setting)
        const isDuplicate = caseSensitive
          ? searchTerms.some((t) => t.term === trimmed)
          : searchTerms.some((t) => t.term.toLowerCase() === trimmed.toLowerCase());
        if (isDuplicate) return;
        const color = SEARCH_TERM_COLORS[searchTerms.length % SEARCH_TERM_COLORS.length];
        const newTerm: SearchTerm = { id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, term: trimmed, color };
        set({ searchTerms: [...searchTerms, newTerm], searchQuery: '' });
        // Auto-search after adding
        setTimeout(() => get().search(), 0);
      },

      removeSearchTerm: (id) => {
        const { searchTerms } = get();
        const updated = searchTerms.filter((t) => t.id !== id);
        set({ searchTerms: updated });
        if (updated.length > 0) {
          setTimeout(() => get().search(), 0);
        } else {
          set({ searchResults: [], currentResultIndex: -1 });
        }
      },

      clearSearchTerms: () => {
        set({ searchTerms: [], searchResults: [], currentResultIndex: -1, searchQuery: '' });
      },

      extractAllKeywords: () => {
        const { pageTextContents, isExtractingKeywords } = get();
        if (isExtractingKeywords || pageTextContents.length === 0) return;
        set({ isExtractingKeywords: true, keywordProgress: { current: 0, total: 3 } });

        (async () => {
          try {
            // Sequential extraction with progress updates
            const { extractKeywordsByAlgorithm } = await import('@/lib/keywordExtractor');
            const cache: Record<string, ExtractedKeyword[]> = {};
            const algos: Array<'tfidf' | 'textrank' | 'ngram'> = ['tfidf', 'textrank', 'ngram'];
            for (let i = 0; i < algos.length; i++) {
              cache[algos[i]] = await extractKeywordsByAlgorithm(pageTextContents, algos[i]);
              set({ keywordProgress: { current: i + 1, total: 3 } });
            }
            const algo = get().keywordAlgorithm;
            const active = cache[algo] || [];
            set({
              allKeywords: cache,
              keywords: active,
              isExtractingKeywords: false,
              keywordProgress: null,
            });
          } catch {
            set({ isExtractingKeywords: false, keywordProgress: null });
          }
        })();
      },

      setKeywordAlgorithm: (algo) => {
        const { allKeywords } = get();
        set({ keywordAlgorithm: algo, keywords: allKeywords[algo] || null });
      },

      toggleKeywordHighlight: (term) => {
        const prev = get().activeKeywords;
        const idx = prev.indexOf(term);
        const next = idx >= 0 ? prev.filter((t) => t !== term) : [...prev, term];
        set({ activeKeywords: next });
      },

      setSidebarTab: (tab) => set({ sidebarTab: tab }),

      clearKeywords: () => {
        set({
          keywords: null,
          allKeywords: {},
          activeKeywords: [],
          isExtractingKeywords: false,
          keywordProgress: null,
        });
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
        set({
          ...initialState,
          hasSeenTutorial,
          dailyUsage,
          viewerMode,
          keywords: null,
          allKeywords: {},
          activeKeywords: [],
          isExtractingKeywords: false,
          keywordProgress: null,
        });
      },
    }),
    {
      name: 'paperlens-storage',
      partialize: (state: AppState) => ({
        hasSeenTutorial: state.hasSeenTutorial,
        dailyUsage: state.dailyUsage,
        viewerMode: state.viewerMode,
        sidebarTab: state.sidebarTab,
      }),
    }
  )
);

export default useStore;
