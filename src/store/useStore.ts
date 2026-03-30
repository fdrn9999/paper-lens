import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PageTextContent, SearchResult, TranslationErrorCode, ExtractedKeyword, KeywordAlgorithm, SearchTerm, ChatMessage } from '@/lib/types';
import { exactSearch } from '@/lib/searchEngine';

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
let chatAbortController: AbortController | null = null;
const quotaTimerMap: Record<string, ReturnType<typeof setTimeout>> = {};
let progressiveSearchTimer: ReturnType<typeof setTimeout> | null = null;

function clearQuotaTimers() {
  for (const key of Object.keys(quotaTimerMap)) {
    clearTimeout(quotaTimerMap[key]);
    delete quotaTimerMap[key];
  }
}

function scheduleQuotaReset(get: () => AppState, set: (s: Partial<AppState>) => void, type: 'chat' | 'translate') {
  if (quotaTimerMap[type]) return;
  const retryKey = type === 'chat' ? 'chatRetryAt' : 'translateRetryAt';
  set({ [retryKey]: Date.now() + 60000 });
  quotaTimerMap[type] = setTimeout(() => {
    delete quotaTimerMap[type];
    set({ [retryKey]: null });
  }, 60000);
}

const API_TIMEOUT_MS = 60000; // 60s for chat (longer than search)

/** Return UTC date string (YYYY-MM-DD) */
function getUTCDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Wrap fetch with a per-request timeout. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  const externalSignal = init.signal;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
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
  searchResults: SearchResult[];
  currentResultIndex: number;
  caseSensitive: boolean;
  isSearching: boolean;
  lastSearchedQuery: string;
  searchTerms: SearchTerm[];

  selectedText: string;
  translationResult: string;
  isTranslating: boolean;
  isTranslationError: boolean;
  translationErrorCode: TranslationErrorCode | null;
  translationErrorDetail: string;
  showTranslation: boolean;

  translateQuota: { usedPercent: number; usedChars: number; limitChars: number } | null;
  chatQuota: { usedPercent: number; usedChars: number; limitChars: number } | null;
  translateRetryAt: number | null;
  chatRetryAt: number | null;
  dailyUsage: { translate: number; chat: number; date: string };

  // Chat (AI)
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  chatSummary: string | null;
  isSummarizing: boolean;

  // Keywords
  keywords: ExtractedKeyword[] | null;
  keywordAlgorithm: KeywordAlgorithm;
  allKeywords: Record<string, ExtractedKeyword[]>;
  activeKeywords: string[];
  isExtractingKeywords: boolean;
  keywordProgress: { current: number; total: number } | null;
  sidebarTab: 'search' | 'keywords' | 'chat';

  viewerMode: 'scroll' | 'page';

  hasSeenTutorial: boolean;
  isGuideActive: boolean;
  tutorialStep: number;
  isSidebarOpen: boolean;

  // Actions
  setPdfFile: (file: File | null) => void;
  setPdfData: (data: Uint8Array | null) => void;
  setTotalPages: (n: number) => void;
  setCurrentPage: (n: number) => void;
  setScale: (s: number) => void;
  setPageTextContents: (contents: PageTextContent[]) => void;
  setIsLoadingPdf: (v: boolean) => void;
  setIsExtracting: (v: boolean) => void;

  setSearchQuery: (q: string) => void;
  setCaseSensitive: (v: boolean) => void;
  search: () => void;
  clearSearch: () => void;
  nextResult: () => void;
  prevResult: () => void;
  goToResult: (index: number) => void;
  addSearchTerm: (term: string) => void;
  removeSearchTerm: (id: string) => void;
  clearSearchTerms: () => void;

  setSelectedText: (text: string) => void;
  setShowTranslation: (v: boolean) => void;
  translate: (text: string) => Promise<void>;
  updateQuotaFromHeaders: (type: 'translate' | 'chat', headers: Headers) => void;
  incrementDailyUsage: (type: 'translate' | 'chat', charCount?: number) => void;
  getDailyUsage: (type: 'translate' | 'chat') => number;

  // Chat actions
  sendChatMessage: (message: string) => Promise<void>;
  summarizePaper: () => Promise<void>;
  clearChat: () => void;

  // Keyword actions
  extractAllKeywords: () => void;
  setKeywordAlgorithm: (algo: KeywordAlgorithm) => void;
  toggleKeywordHighlight: (term: string) => void;
  toggleAllKeywordHighlights: () => void;
  clearKeywords: () => void;
  setSidebarTab: (tab: 'search' | 'keywords' | 'chat') => void;

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
  searchResults: [],
  currentResultIndex: -1,
  caseSensitive: false,
  isSearching: false,
  lastSearchedQuery: '',
  searchTerms: [] as SearchTerm[],
  selectedText: '',
  translationResult: '',
  isTranslating: false,
  isTranslationError: false,
  translationErrorCode: null,
  translationErrorDetail: '',
  showTranslation: false,
  translateQuota: null,
  chatQuota: null,
  translateRetryAt: null,
  chatRetryAt: null,
  dailyUsage: { translate: 0, chat: 0, date: '' },
  chatMessages: [] as ChatMessage[],
  isChatLoading: false,
  chatSummary: null as string | null,
  isSummarizing: false,
  keywords: null as ExtractedKeyword[] | null,
  keywordAlgorithm: 'tfidf' as KeywordAlgorithm,
  allKeywords: {} as Record<string, ExtractedKeyword[]>,
  activeKeywords: [] as string[],
  isExtractingKeywords: false,
  keywordProgress: null as { current: number; total: number } | null,
  sidebarTab: 'search' as 'search' | 'keywords' | 'chat',
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
        if (chatAbortController) { chatAbortController.abort(); chatAbortController = null; }
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
          searchTerms: [],
          isExtracting: false,
          isSearching: false,
          isTranslating: false,
          isLoadingPdf: false,
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
          chatMessages: [],
          chatSummary: null,
          isChatLoading: false,
          isSummarizing: false,
        });
      },
      setTotalPages: (n) => set({ totalPages: n }),
      setCurrentPage: (n) => {
        const { totalPages } = get();
        if (n >= 1 && n <= totalPages) set({ currentPage: n });
      },
      setScale: (s) => set({ scale: Math.max(0.5, Math.min(3, s)) }),
      setPageTextContents: (contents) => {
        set({ pageTextContents: contents });
        // Debounced progressive search during extraction
        if ((get().searchQuery.trim() || get().searchTerms.length > 0)) {
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
        if (!v) {
          const { searchQuery, searchTerms } = get();
          if (searchQuery.trim() || searchTerms.length > 0) {
            setTimeout(() => get().search(), 0);
          }
          // Auto-extract keywords when text extraction completes
          if (get().pageTextContents.length > 0) {
            setTimeout(() => get().extractAllKeywords(), 200);
          }
        }
      },

      setSearchQuery: (q) => set({ searchQuery: q }),
      setCaseSensitive: (v) => {
        set({ caseSensitive: v });
        const { searchQuery, searchTerms } = get();
        if (searchQuery.trim() || searchTerms.length > 0) {
          setTimeout(() => get().search(), 0);
        }
      },

      search: () => {
        const { pageTextContents, searchQuery, caseSensitive, searchTerms } = get();
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
          allResults.sort((a, b) => a.page - b.page || a.itemIndex - b.itemIndex);
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
      },

      clearSearch: () => {
        set({ searchQuery: '', lastSearchedQuery: '', searchResults: [], currentResultIndex: -1, isSearching: false, searchTerms: [] });
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
          if (typeof window !== 'undefined' && window.innerWidth < 1024) set({ isSidebarOpen: false });
        }
      },

      addSearchTerm: (term) => {
        const trimmed = term.trim();
        if (!trimmed) return;
        const { searchTerms, caseSensitive } = get();
        const isDuplicate = caseSensitive
          ? searchTerms.some((t) => t.term === trimmed)
          : searchTerms.some((t) => t.term.toLowerCase() === trimmed.toLowerCase());
        if (isDuplicate) return;
        const color = SEARCH_TERM_COLORS[searchTerms.length % SEARCH_TERM_COLORS.length];
        const newTerm: SearchTerm = { id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, term: trimmed, color };
        set({ searchTerms: [...searchTerms, newTerm], searchQuery: '' });
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

      updateQuotaFromHeaders: (type, headers) => {
        const usedChars = parseInt(headers.get('X-Quota-Used-Chars') || '', 10);
        const limitChars = parseInt(headers.get('X-Quota-Limit-Chars') || '', 10);
        const usedPercent = parseInt(headers.get('X-Quota-Used-Percent') || '', 10);
        if (!isNaN(usedChars) && !isNaN(limitChars) && !isNaN(usedPercent)) {
          const quota = { usedPercent, usedChars, limitChars };
          if (type === 'translate') set({ translateQuota: quota });
          else set({ chatQuota: quota });
        }
      },

      incrementDailyUsage: (type, charCount = 1) => {
        const today = getUTCDateString();
        const usage = get().dailyUsage;
        if (usage.date !== today) {
          set({ dailyUsage: { translate: type === 'translate' ? charCount : 0, chat: type === 'chat' ? charCount : 0, date: today } });
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

        if (isKoreanText(text)) {
          set({
            selectedText: text, showTranslation: true, translationResult: '',
            isTranslating: false, isTranslationError: true,
            translationErrorCode: 'ALREADY_KOREAN', translationErrorDetail: '',
          });
          showToastSafe('이미 한국어 텍스트입니다.', 'info');
          return;
        }

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
          }, 30000);
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

      // ─── Chat (AI) ───────────────────────────────────────────────────
      sendChatMessage: async (message) => {
        if (!message.trim() || get().isChatLoading) return;

        const chatQ = get().chatQuota;
        if (chatQ && chatQ.usedPercent >= 100) {
          showToastSafe('오늘의 AI 사용량을 초과했습니다.', 'error');
          return;
        }

        if (chatAbortController) chatAbortController.abort();
        const controller = new AbortController();
        chatAbortController = controller;

        const userMsg: ChatMessage = {
          id: `msg-${Date.now()}-u`,
          role: 'user',
          content: message.trim(),
          timestamp: Date.now(),
        };

        set((s) => ({
          chatMessages: [...s.chatMessages, userMsg],
          isChatLoading: true,
        }));

        try {
          // Build paper context from extracted text (first 30k chars)
          const pages = get().pageTextContents;
          const paperContext = pages.map((p) => `[Page ${p.page}]\n${p.fullText}`).join('\n\n').slice(0, 30000);

          // Build history for API
          const history = get().chatMessages
            .filter((m) => m.id !== userMsg.id)
            .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', content: m.content }));

          const res = await fetchWithTimeout('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message.trim(), paperContext, history }),
            signal: controller.signal,
          });

          get().updateQuotaFromHeaders('chat', res.headers);

          if (res.status === 429) {
            set({ chatQuota: { usedPercent: 100, usedChars: 0, limitChars: 0 } });
            scheduleQuotaReset(get, set, 'chat');
            const data = await res.json().catch(() => ({}));
            showToastSafe(data.error || '일일 AI 사용 한도를 초과했습니다.', 'error');
            // Add error message to chat
            const errMsg: ChatMessage = {
              id: `msg-${Date.now()}-e`,
              role: 'assistant',
              content: data.error || '사용량 한도를 초과했습니다. 내일 다시 시도해주세요.',
              timestamp: Date.now(),
            };
            set((s) => ({ chatMessages: [...s.chatMessages, errMsg] }));
            return;
          }

          if (!res.ok) {
            const errMsg: ChatMessage = {
              id: `msg-${Date.now()}-e`,
              role: 'assistant',
              content: `오류가 발생했습니다. (${res.status})`,
              timestamp: Date.now(),
            };
            set((s) => ({ chatMessages: [...s.chatMessages, errMsg] }));
            return;
          }

          const data = await res.json();
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}-a`,
            role: 'assistant',
            content: data.reply || 'AI 응답을 받지 못했습니다.',
            timestamp: Date.now(),
          };

          set((s) => ({ chatMessages: [...s.chatMessages, assistantMsg] }));
          get().incrementDailyUsage('chat');
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return;
          const errContent = err instanceof Error && err.name === 'TimeoutError'
            ? '요청 시간이 초과되었습니다. 다시 시도해주세요.'
            : '네트워크 오류가 발생했습니다.';
          const errMsg: ChatMessage = {
            id: `msg-${Date.now()}-e`,
            role: 'assistant',
            content: errContent,
            timestamp: Date.now(),
          };
          set((s) => ({ chatMessages: [...s.chatMessages, errMsg] }));
        } finally {
          if (chatAbortController === controller) {
            chatAbortController = null;
            set({ isChatLoading: false });
          }
        }
      },

      summarizePaper: async () => {
        if (get().isSummarizing || get().chatSummary) return;
        const pages = get().pageTextContents;
        if (pages.length === 0) return;

        if (chatAbortController) chatAbortController.abort();
        const controller = new AbortController();
        chatAbortController = controller;

        set({ isSummarizing: true });

        try {
          const paperContext = pages.map((p) => `[Page ${p.page}]\n${p.fullText}`).join('\n\n').slice(0, 30000);

          const res = await fetchWithTimeout('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: '이 논문을 요약해주세요. 제목, 저자(있다면), 주요 목적, 방법론, 핵심 결과, 결론을 포함하여 구조화된 형태로 요약해주세요.',
              paperContext,
              history: [],
            }),
            signal: controller.signal,
          });

          get().updateQuotaFromHeaders('chat', res.headers);

          if (!res.ok) {
            set({ chatSummary: '논문 요약에 실패했습니다. 나중에 다시 시도해주세요.' });
            return;
          }

          const data = await res.json();
          set({ chatSummary: data.reply || '요약 결과를 받지 못했습니다.' });
          get().incrementDailyUsage('chat');
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return;
          set({ chatSummary: '논문 요약 중 오류가 발생했습니다.' });
        } finally {
          if (chatAbortController === controller) chatAbortController = null;
          set({ isSummarizing: false });
        }
      },

      clearChat: () => {
        if (chatAbortController) { chatAbortController.abort(); chatAbortController = null; }
        set({ chatMessages: [], chatSummary: null, isChatLoading: false, isSummarizing: false });
      },

      // ─── Keywords ─────────────────────────────────────────────────────
      extractAllKeywords: () => {
        const { pageTextContents, isExtractingKeywords } = get();
        if (isExtractingKeywords || pageTextContents.length === 0) return;
        set({ isExtractingKeywords: true, keywordProgress: { current: 0, total: 3 } });

        (async () => {
          try {
            const { extractKeywordsByAlgorithm } = await import('@/lib/keywordExtractor');
            const cache: Record<string, ExtractedKeyword[]> = {};
            const algos: Array<'tfidf' | 'textrank' | 'ngram'> = ['tfidf', 'textrank', 'ngram'];
            for (let i = 0; i < algos.length; i++) {
              cache[algos[i]] = await extractKeywordsByAlgorithm(pageTextContents, algos[i]);
              set({ keywordProgress: { current: i + 1, total: 3 } });
            }
            const algo = get().keywordAlgorithm;
            set({
              allKeywords: cache,
              keywords: cache[algo] || [],
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

      toggleAllKeywordHighlights: () => {
        const { keywords, activeKeywords } = get();
        if (!keywords || keywords.length === 0) return;
        if (activeKeywords.length > 0) {
          set({ activeKeywords: [] });
        } else {
          set({ activeKeywords: keywords.map((k) => k.term) });
        }
      },

      clearKeywords: () => {
        set({ keywords: null, allKeywords: {}, activeKeywords: [], isExtractingKeywords: false, keywordProgress: null });
      },

      setSidebarTab: (tab) => set({ sidebarTab: tab }),

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
        if (chatAbortController) { chatAbortController.abort(); chatAbortController = null; }
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
          chatMessages: [],
          chatSummary: null,
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
