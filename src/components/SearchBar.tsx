'use client';

import { useCallback, useRef, useState, useEffect, memo } from 'react';
import useStore from '@/store/useStore';

export default memo(function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSearchedRef = useRef('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDebouncing, setIsDebouncing] = useState(false);

  const searchQuery = useStore((s) => s.searchQuery);
  const searchResults = useStore((s) => s.searchResults);
  const currentResultIndex = useStore((s) => s.currentResultIndex);
  const caseSensitive = useStore((s) => s.caseSensitive);
  const isSearching = useStore((s) => s.isSearching);
  const pdfData = useStore((s) => s.pdfData);
  const searchTerms = useStore((s) => s.searchTerms);

  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const setCaseSensitive = useStore((s) => s.setCaseSensitive);
  const search = useStore((s) => s.search);
  const clearSearch = useStore((s) => s.clearSearch);
  const nextResult = useStore((s) => s.nextResult);
  const prevResult = useStore((s) => s.prevResult);
  const addSearchTerm = useStore((s) => s.addSearchTerm);
  const removeSearchTerm = useStore((s) => s.removeSearchTerm);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // With searchTerms, don't auto-search on typing (user adds terms with Enter)
    if (searchTerms.length > 0) {
      setIsDebouncing(false);
      return;
    }

    if (value.trim()) {
      setIsDebouncing(true);
      debounceRef.current = setTimeout(() => {
        setIsDebouncing(false);
        debounceRef.current = null;
        search();
        lastSearchedRef.current = value.trim();
      }, 500);
    } else {
      setIsDebouncing(false);
      if (!value.trim() && searchTerms.length === 0) {
        clearSearch();
        lastSearchedRef.current = '';
      }
    }
  }, [setSearchQuery, search, clearSearch, searchTerms.length]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; setIsDebouncing(false); }
      const q = searchQuery.trim();
      if (!q) return;

      // Enter adds a search term
      addSearchTerm(q);
    },
    [searchQuery, addSearchTerm]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; setIsDebouncing(false); }
        prevResult();
      } else if (e.key === 'Enter') {
        // Handled by form onSubmit
      } else if (e.key === 'Backspace' && !searchQuery && searchTerms.length > 0) {
        // Backspace on empty input removes the last term
        e.preventDefault();
        removeSearchTerm(searchTerms[searchTerms.length - 1].id);
      } else if (e.key === 'Escape') {
        if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; setIsDebouncing(false); }
        clearSearch();
        lastSearchedRef.current = '';
        inputRef.current?.blur();
      }
    },
    [prevResult, clearSearch, searchQuery, searchTerms, removeSearchTerm]
  );

  if (!pdfData) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 flex-1">
      {/* Row 1: Search input + submit button */}
      <form onSubmit={handleSearch} role="search" className="flex items-center gap-2 flex-1 min-w-0">
        <div className="relative flex-1 min-w-0">
          {/* Search icon */}
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          {/* Input container with search term chips */}
          <div
            className="flex items-center flex-wrap gap-1 min-h-[40px] max-h-[80px] overflow-y-auto pl-9 pr-2 py-1 border border-gray-300 rounded-lg
                       focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            {/* Search term chips */}
            {searchTerms.map((st) => (
              <span
                key={st.id}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium text-white shrink-0"
                style={{ backgroundColor: st.color }}
              >
                {st.term}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeSearchTerm(st.id); }}
                  className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-white/30 transition-colors"
                  aria-label={`${st.term} 검색어 삭제`}
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}

            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                searchTerms.length > 0
                  ? '검색어 추가 (Enter)'
                  : '검색어 입력 후 Enter (여러 단어 등록 가능)'
              }
              aria-label="검색어 입력"
              className="flex-1 min-w-[80px] py-1 text-sm bg-transparent focus:outline-none"
            />
          </div>
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
            추가
          </button>
        )}
      </form>

      {/* Row 2 on mobile / same row on sm+: mode toggle, case sensitivity, nav, indicators */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
        {/* Case sensitivity */}
        <button
          onClick={() => setCaseSensitive(!caseSensitive)}
          title={caseSensitive ? '대소문자 구분 ON' : '대소문자 구분 OFF'}
          className={`px-2 py-2 min-h-[44px] sm:min-h-0 text-xs font-mono rounded-lg border transition-colors shrink-0
            ${caseSensitive
              ? 'bg-blue-100 border-blue-300 text-blue-700'
              : 'bg-gray-100 border-gray-300 text-gray-500'
            }`}
        >
          Aa
        </button>

        {/* Clear all terms button */}
        {searchTerms.length >= 1 && (
          <button
            onClick={() => { clearSearch(); lastSearchedRef.current = ''; }}
            className="px-2 py-2 min-h-[44px] sm:min-h-0 text-xs rounded-lg border border-gray-300 bg-gray-100 text-gray-500 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors shrink-0"
            title="모든 검색어 삭제"
            aria-label="모든 검색어 삭제"
          >
            전체 삭제
          </button>
        )}

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

      </div>
    </div>
  );
});
