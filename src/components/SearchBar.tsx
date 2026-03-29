'use client';

import { useCallback, useRef, useState, useEffect, memo } from 'react';
import useStore from '@/store/useStore';
import { getEmbeddingMessage } from '@/lib/messages';
import QuotaIndicator from '@/components/QuotaIndicator';

export default memo(function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSearchedRef = useRef('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDebouncing, setIsDebouncing] = useState(false);

  const searchQuery = useStore((s) => s.searchQuery);
  const searchMode = useStore((s) => s.searchMode);
  const searchResults = useStore((s) => s.searchResults);
  const currentResultIndex = useStore((s) => s.currentResultIndex);
  const caseSensitive = useStore((s) => s.caseSensitive);
  const isEmbedding = useStore((s) => s.isEmbedding);
  const isSearching = useStore((s) => s.isSearching);
  const embeddingProgress = useStore((s) => s.embeddingProgress);
  const isExtracting = useStore((s) => s.isExtracting);
  const extractedPageCount = useStore((s) => s.pageTextContents.length);
  const totalPages = useStore((s) => s.totalPages);
  const embedQuota = useStore((s) => s.embedQuota);
  const retryAvailableAt = useStore((s) => s.embedRetryAt);
  const pdfData = useStore((s) => s.pdfData);

  // Countdown timer for rate limit feedback
  const [retrySec, setRetrySec] = useState(0);
  useEffect(() => {
    if (!retryAvailableAt) { setRetrySec(0); return; }
    const tick = () => setRetrySec(Math.max(0, Math.ceil((retryAvailableAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [retryAvailableAt]);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const setSearchMode = useStore((s) => s.setSearchMode);
  const setCaseSensitive = useStore((s) => s.setCaseSensitive);
  const search = useStore((s) => s.search);
  const clearSearch = useStore((s) => s.clearSearch);
  const nextResult = useStore((s) => s.nextResult);
  const prevResult = useStore((s) => s.prevResult);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (searchMode === 'exact' && value.trim()) {
      setIsDebouncing(true);
      debounceRef.current = setTimeout(() => {
        setIsDebouncing(false);
        debounceRef.current = null;
        search();
        lastSearchedRef.current = value.trim();
      }, 500);
    } else {
      setIsDebouncing(false);
      if (!value.trim()) {
        clearSearch();
        lastSearchedRef.current = '';
      }
    }
  }, [searchMode, setSearchQuery, search, clearSearch]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; setIsDebouncing(false); }
      const q = searchQuery.trim();
      if (!q) return;
      if (q === lastSearchedRef.current && searchResults.length > 0) {
        nextResult();
      } else {
        search();
        lastSearchedRef.current = q;
      }
    },
    [search, searchQuery, searchResults.length, nextResult]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; setIsDebouncing(false); }
        prevResult();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; setIsDebouncing(false); }
        const q = searchQuery.trim();
        if (!q) return;
        if (q !== lastSearchedRef.current || searchResults.length === 0) {
          search();
          lastSearchedRef.current = q;
        } else {
          nextResult();
        }
      } else if (e.key === 'Escape') {
        if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; setIsDebouncing(false); }
        clearSearch();
        lastSearchedRef.current = '';
        inputRef.current?.blur();
      }
    },
    [search, nextResult, prevResult, clearSearch, searchQuery, searchResults.length]
  );

  if (!pdfData) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 flex-1">
      {/* Row 1: Search input + submit button (always full width on mobile) */}
      <form onSubmit={handleSearch} role="search" className="flex items-center gap-2 flex-1 min-w-0">
        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={searchMode === 'exact' ? '정확한 키워드 검색' : 'AI 의미 기반 검색'}
            aria-label="검색어 입력"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {isSearching ? (
          <button
            type="button"
            onClick={() => { clearSearch(); lastSearchedRef.current = ''; }}
            className="px-3 sm:px-4 py-2 text-sm bg-gray-500 text-white rounded-lg
                       hover:bg-gray-600 active:bg-gray-700 transition-colors font-medium shrink-0 min-h-[44px]"
            aria-label="검색 취소"
          >
            취소
          </button>
        ) : (
          <button
            type="submit"
            className="px-3 sm:px-4 py-2 text-sm bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium shrink-0 min-h-[44px]"
          >
            검색
          </button>
        )}
      </form>

      {/* Row 2 on mobile / same row on sm+: mode toggle, case sensitivity, nav, indicators */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
        {/* Search mode toggle */}
        <div data-guide="search-mode" className="flex rounded-lg border border-gray-300 overflow-hidden text-xs shrink-0">
          <button
            onClick={() => { if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; setIsDebouncing(false); } setSearchMode('exact'); }}
            className={`px-2.5 py-2 min-h-[44px] sm:min-h-0 transition-colors flex items-center gap-1 ${
              searchMode === 'exact'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            title="정확한 단어 일치 검색 — 입력한 키워드와 정확히 일치하는 단어를 찾습니다. (Ctrl+F와 유사하지만 단어 단위 매칭)"
            aria-label="정확한 단어 일치 검색"
            aria-pressed={searchMode === 'exact'}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            정확
          </button>
          <button
            onClick={() => { if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; setIsDebouncing(false); } setSearchMode('semantic'); }}
            disabled={isExtracting}
            className={`px-2.5 py-2 min-h-[44px] sm:min-h-0 transition-colors flex items-center gap-1 ${
              searchMode === 'semantic'
                ? 'bg-purple-600 text-white'
                : isExtracting
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            title={isExtracting
              ? `텍스트 추출 중 (${extractedPageCount}/${totalPages}) — 완료 후 사용 가능`
              : 'AI 의미 기반 검색 — 의미적으로 유사한 문장을 AI가 찾습니다. 예: "AI" 검색 → "Artificial Intelligence" 발견'}
            aria-label="AI 의미 기반 검색"
            aria-pressed={searchMode === 'semantic'}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI
          </button>
        </div>

        {/* Inline extraction progress indicator */}
        {isExtracting && (
          <span className={`text-[10px] whitespace-nowrap flex items-center gap-1 ${searchMode === 'semantic' ? 'text-purple-500' : 'text-amber-500 md:hidden'}`}>
            {searchMode === 'semantic' && (
              <span className="animate-spin inline-block w-3 h-3 border-[1.5px] border-purple-400 border-t-transparent rounded-full" />
            )}
            {searchMode === 'semantic'
              ? `문서 분석 중 (${Math.round((extractedPageCount / Math.max(totalPages, 1)) * 100)}%)`
              : `${extractedPageCount}/${totalPages}`}
          </span>
        )}

        {/* Case sensitivity — always rendered to prevent layout shift, invisible when not exact */}
        <button
          onClick={() => setCaseSensitive(!caseSensitive)}
          title={caseSensitive ? '대소문자 구분 ON' : '대소문자 구분 OFF'}
          aria-hidden={searchMode !== 'exact' ? true : undefined}
          tabIndex={searchMode !== 'exact' ? -1 : undefined}
          className={`px-2 py-2 min-h-[44px] sm:min-h-0 text-xs font-mono rounded-lg border transition-colors shrink-0
            ${searchMode !== 'exact'
              ? 'hidden'
              : caseSensitive
                ? 'bg-blue-100 border-blue-300 text-blue-700'
                : 'bg-gray-100 border-gray-300 text-gray-500'
            }`}
        >
          Aa
        </button>

        {/* Result navigation */}
        {searchResults.length > 0 && (
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap min-w-[50px] sm:min-w-[60px] text-center">
              {currentResultIndex + 1} / {searchResults.length}
            </span>
            <button onClick={prevResult} className="p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded hover:bg-gray-200 transition-colors flex items-center justify-center" title="이전 (Shift+Enter)" aria-label="이전 결과">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button onClick={nextResult} className="p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded hover:bg-gray-200 transition-colors flex items-center justify-center" title="다음 (Enter)" aria-label="다음 결과">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* Exact search debounce indicator */}
        {isDebouncing && (
          <span className="text-xs text-gray-400 whitespace-nowrap animate-pulse">검색 중...</span>
        )}

        {/* Embedding progress / quota / countdown indicator */}
        {retrySec > 0 ? (
          <span className="text-xs text-red-500 whitespace-nowrap">{retrySec}초 후 재시도</span>
        ) : embeddingProgress ? (
          <span className="text-xs text-purple-600 whitespace-nowrap animate-pulse">{getEmbeddingMessage(embeddingProgress)}</span>
        ) : searchMode === 'semantic' && embedQuota ? (
          <QuotaIndicator
            label="AI"
            usedPercent={embedQuota.usedPercent}
            color="purple"
            compact
          />
        ) : null}
      </div>
    </div>
  );
});
