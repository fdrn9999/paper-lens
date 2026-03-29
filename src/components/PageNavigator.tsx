'use client';

import { useCallback, useState, useEffect, memo } from 'react';
import useStore from '@/store/useStore';

export default memo(function PageNavigator() {
  const currentPage = useStore((s) => s.currentPage);
  const totalPages = useStore((s) => s.totalPages);
  const scale = useStore((s) => s.scale);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const setScale = useStore((s) => s.setScale);
  const pdfData = useStore((s) => s.pdfData);
  const isExtracting = useStore((s) => s.isExtracting);
  const pageTextContents = useStore((s) => s.pageTextContents);
  const viewerMode = useStore((s) => s.viewerMode);
  const setViewerMode = useStore((s) => s.setViewerMode);

  // Local input state so user can freely clear/edit the field
  const [inputValue, setInputValue] = useState(String(currentPage));

  // Sync local state when global currentPage changes (e.g. from navigation buttons)
  useEffect(() => {
    setInputValue(String(currentPage));
  }, [currentPage]);

  const commitPage = useCallback(() => {
    const val = parseInt(inputValue, 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      setCurrentPage(val);
    } else {
      // Revert to current page if invalid
      setInputValue(String(currentPage));
    }
  }, [inputValue, totalPages, currentPage, setCurrentPage]);

  const handlePageInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commitPage();
        (e.target as HTMLInputElement).blur();
      }
    },
    [commitPage]
  );

  if (!pdfData || totalPages === 0) return null;

  const isPageMode = viewerMode === 'page';

  return (
    <nav className="flex items-center justify-between px-2 sm:px-4 md:px-6 py-2 bg-white border-t text-xs sm:text-sm" aria-label="페이지 탐색">
      <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
        {/* Mode toggle */}
        <button
          data-guide="viewer-mode"
          onClick={() => setViewerMode(isPageMode ? 'scroll' : 'page')}
          className="px-2 py-1 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
          title={isPageMode ? '스크롤 모드로 전환' : '페이지 모드로 전환'}
          aria-label={isPageMode ? '스크롤 모드로 전환' : '페이지 모드로 전환'}
        >
          {isPageMode ? (
            /* Current: page mode — icon shows single page */
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="3" width="16" height="18" rx="1.5" strokeWidth={1.5} />
              <path strokeLinecap="round" strokeWidth={1.5} d="M8 8h8M8 12h8M8 16h5" />
            </svg>
          ) : (
            /* Current: scroll mode — icon shows continuous scroll */
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="2" width="16" height="7" rx="1" strokeWidth={1.5} />
              <rect x="4" y="11" width="16" height="7" rx="1" strokeWidth={1.5} />
              <path strokeLinecap="round" strokeWidth={1.5} d="M12 20v2M12 20l-2-1.5M12 20l2-1.5" />
            </svg>
          )}
        </button>

        <button
          onClick={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-2 py-1 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="이전 페이지"
        >
          ◀
        </button>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={inputValue}
            onChange={handlePageInput}
            onBlur={commitPage}
            onKeyDown={handleKeyDown}
            min={1}
            max={totalPages}
            aria-label="페이지 번호"
            className="w-10 sm:w-12 text-center border rounded px-1 py-0.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-gray-500">/ {totalPages}</span>
        </div>
        <button
          onClick={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-2 py-1 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="다음 페이지"
        >
          ▶
        </button>
      </div>

      {isExtracting && totalPages > 0 && (
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-600">
          <div className="animate-spin h-3 w-3 border-[1.5px] border-amber-500 border-t-transparent rounded-full" />
          <span>텍스트 추출 중 ({pageTextContents.length}/{totalPages})</span>
        </div>
      )}

      <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
        <button
          onClick={() => setScale(scale - 0.25)}
          disabled={scale <= 0.5}
          className="px-2 py-1 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
          title="축소"
          aria-label="축소"
        >
          −
        </button>
        <span className="text-gray-600 min-w-[50px] text-center" aria-live="polite">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(scale + 0.25)}
          disabled={scale >= 3}
          className="px-2 py-1 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
          title="확대"
          aria-label="확대"
        >
          +
        </button>
      </div>
    </nav>
  );
});
