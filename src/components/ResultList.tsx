'use client';

import { useCallback, useMemo, useRef, useState, memo, useEffect } from 'react';
import useStore from '@/store/useStore';
import type { SearchResult } from '@/lib/types';

const ITEM_HEIGHT = 56;
const HEADER_HEIGHT = 28;
const OVERSCAN = 10;

type VirtualItem =
  | { type: 'header'; page: number; count: number }
  | { type: 'result'; result: SearchResult; globalIndex: number };

function getVirtualItemHeight(item: VirtualItem): number {
  if (item.type === 'header') return HEADER_HEIGHT;
  return ITEM_HEIGHT;
}

/** Find keyword in context reliably, falling back to charStart/charEnd */
function findMatchInContext(context: string, matchedToken: string, charStart: number, charEnd: number) {
  // First try: find matchedToken directly in context (case-insensitive)
  const ctxLower = context.toLowerCase();
  const tokenLower = matchedToken.toLowerCase();
  const idx = ctxLower.indexOf(tokenLower);
  if (idx >= 0) {
    return { start: idx, end: idx + matchedToken.length };
  }
  // Second try: use charStart/charEnd if they are within bounds and produce non-empty text
  if (charStart >= 0 && charEnd <= context.length && charStart < charEnd) {
    return { start: charStart, end: charEnd };
  }
  // Last resort: show the full context without highlight
  return null;
}

function HighlightedContext({ result, isCurrent }: { result: SearchResult; isCurrent: boolean }) {
  const match = findMatchInContext(result.context, result.matchedToken, result.charStart, result.charEnd);

  if (!match) {
    return (
      <p className="text-gray-700 leading-snug text-xs line-clamp-2">
        {result.context.slice(0, 120)}{result.context.length > 120 ? '...' : ''}
      </p>
    );
  }

  const before = result.context.slice(0, match.start);
  const highlighted = result.context.slice(match.start, match.end);
  const after = result.context.slice(match.end);

  // Keep before short so the keyword is always visible, even on narrow sidebars
  const beforeBudget = Math.min(20, before.length);
  const afterBudget = Math.min(60, after.length);

  const beforeText = before.length > beforeBudget
    ? '...' + before.slice(-beforeBudget)
    : before;
  const afterText = after.length > afterBudget
    ? after.slice(0, afterBudget) + '...'
    : after;

  const color = result.termColor || '#FFD500';

  return (
    <p className="text-gray-700 leading-snug text-xs line-clamp-2">
      {beforeText}
      <span
        className="font-bold"
        style={{
          color: isCurrent ? '#ea580c' : undefined,
          backgroundColor: isCurrent ? 'rgba(255,100,0,0.12)' : `${color}30`,
          borderBottom: `2px solid ${isCurrent ? '#ea580c' : color}`,
          borderRadius: '1px',
          padding: '0 1px',
        }}
      >
        {highlighted}
      </span>
      {afterText}
    </p>
  );
}

function TermBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white shrink-0 truncate max-w-[60px]"
      style={{ backgroundColor: color }}
      title={label}
    >
      {label}
    </span>
  );
}

const ResultItem = memo(function ResultItem({
  result,
  isCurrent,
  globalIndex,
  searchQuery,
  onGoToResult,
  hasMultiTerms,
}: {
  result: SearchResult;
  isCurrent: boolean;
  globalIndex: number;
  searchQuery: string;
  onGoToResult: (idx: number) => void;
  hasMultiTerms: boolean;
}) {
  const handleClick = useCallback(() => onGoToResult(globalIndex), [onGoToResult, globalIndex]);

  return (
    <button
      role="option"
      aria-selected={isCurrent}
      aria-label={`페이지 ${result.page}: ${result.matchedToken}`}
      onClick={handleClick}
      className={`w-full h-[56px] overflow-hidden text-left px-3 py-2 text-sm transition-colors
        ${isCurrent
          ? 'bg-orange-50 border-l-2 border-orange-400'
          : 'hover:bg-gray-50 border-l-2 border-transparent'
        }`}
      style={!isCurrent && result.termColor ? { borderLeftColor: result.termColor, borderLeftWidth: '2px' } : undefined}
    >
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <HighlightedContext result={result} isCurrent={isCurrent} />
        </div>
        {hasMultiTerms && result.termColor && result.termLabel && (
          <TermBadge color={result.termColor} label={result.termLabel} />
        )}
      </div>
    </button>
  );
});

export default memo(function ResultList() {
  const searchResults = useStore((s) => s.searchResults);
  const currentResultIndex = useStore((s) => s.currentResultIndex);
  const searchQuery = useStore((s) => s.searchQuery);
  const goToResult = useStore((s) => s.goToResult);
  const nextResult = useStore((s) => s.nextResult);
  const prevResult = useStore((s) => s.prevResult);
  const pdfData = useStore((s) => s.pdfData);
  const isExtracting = useStore((s) => s.isExtracting);
  const pageTextContents = useStore((s) => s.pageTextContents);
  const searchTerms = useStore((s) => s.searchTerms);
  const hasMultiTerms = searchTerms.length > 1;

  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrollRafRef = useRef(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewHeight, setViewHeight] = useState(600);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(userScrollTimerRef.current);
      cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  // Track container height changes (resize, orientation change)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewHeight(el.clientHeight);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        nextResult();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        prevResult();
      }
    },
    [nextResult, prevResult]
  );

  // Build flat virtual items with global indices (avoids O(n²) indexOf)
  const virtualItems = useMemo(() => {
    const items: VirtualItem[] = [];
    const pageGroups = new Map<number, { result: SearchResult; globalIndex: number }[]>();
    for (let i = 0; i < searchResults.length; i++) {
      const r = searchResults[i];
      const group = pageGroups.get(r.page) || [];
      group.push({ result: r, globalIndex: i });
      pageGroups.set(r.page, group);
    }
    for (const [page, results] of pageGroups.entries()) {
      items.push({ type: 'header', page, count: results.length });
      for (const entry of results) {
        items.push({ type: 'result', result: entry.result, globalIndex: entry.globalIndex });
      }
    }
    return items;
  }, [searchResults]);

  // Cumulative offsets for virtual scrolling (variable height per item type)
  const { offsets, totalHeight } = useMemo(() => {
    const offs: number[] = [];
    let y = 0;
    for (const item of virtualItems) {
      offs.push(y);
      y += getVirtualItemHeight(item);
    }
    return { offsets: offs, totalHeight: y };
  }, [virtualItems]);

  // Visible range
  const { startIdx, endIdx } = useMemo(() => {
    if (virtualItems.length === 0) return { startIdx: 0, endIdx: 0 };
    let start = 0;
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i] + getVirtualItemHeight(virtualItems[i]) > scrollTop) { start = i; break; }
    }
    start = Math.max(0, start - OVERSCAN);
    let end = virtualItems.length;
    for (let i = start; i < offsets.length; i++) {
      if (offsets[i] > scrollTop + viewHeight) { end = i; break; }
    }
    end = Math.min(virtualItems.length, end + OVERSCAN);
    return { startIdx: start, endIdx: end };
  }, [virtualItems, offsets, scrollTop, viewHeight]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // Throttle state updates to one per animation frame to prevent scroll jank
    cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      setScrollTop(el.scrollTop);
      setViewHeight(el.clientHeight);
    });
    // Mark as user-initiated scroll — suppress auto-scroll briefly to prevent hijack
    userScrolledRef.current = true;
    clearTimeout(userScrollTimerRef.current);
    userScrollTimerRef.current = setTimeout(() => { userScrolledRef.current = false; }, 300);
  }, []);

  // Auto-scroll to current result in the list
  useEffect(() => {
    if (currentResultIndex < 0 || !scrollRef.current || userScrolledRef.current) return;
    const idx = virtualItems.findIndex(
      (item) => item.type === 'result' && item.globalIndex === currentResultIndex
    );
    if (idx < 0) return;
    const itemOffset = offsets[idx] ?? 0;
    const itemH = getVirtualItemHeight(virtualItems[idx]);
    const el = scrollRef.current;
    // offsets are relative to the virtual container which starts after the sticky header
    const STICKY_H = 45;
    const actualItemTop = STICKY_H + itemOffset;
    const visibleTop = el.scrollTop + STICKY_H;
    const visibleBottom = el.scrollTop + el.clientHeight;
    if (actualItemTop < visibleTop || actualItemTop + itemH > visibleBottom) {
      // Center item in the visible area below the sticky header
      const visibleHeight = el.clientHeight - STICKY_H;
      el.scrollTop = actualItemTop - STICKY_H - visibleHeight / 2 + itemH / 2;
    }
  }, [currentResultIndex, virtualItems, offsets]);

  if (!pdfData) return null;

  if (isExtracting && searchResults.length === 0 && !searchQuery) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        <div className="animate-pulse">텍스트 추출 중...</div>
      </div>
    );
  }

  if (searchResults.length === 0 && (searchQuery || searchTerms.length > 0)) {
    return (
      <div className="p-4 text-center text-sm">
        {isExtracting ? (
          <div className="text-amber-600">
            <p>&quot;{searchTerms.length > 0 ? searchTerms.map(t => t.term).join(', ') : searchQuery}&quot; 검색 중...</p>
            <p className="text-xs text-gray-400 mt-1">
              텍스트 추출이 진행 중이므로 결과가 추가될 수 있습니다 ({pageTextContents.length}페이지 완료)
            </p>
          </div>
        ) : (
          <div className="text-gray-500">
            <p>&quot;{searchTerms.length > 0 ? searchTerms.map(t => t.term).join(', ') : searchQuery}&quot;에 대한 검색 결과가 없습니다.</p>
            <div className="mt-2 text-xs text-gray-400 space-y-1">
              <p>대소문자 구분이 켜져 있다면 끄고 시도해 보세요.</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (searchResults.length === 0) {
    const hasNoText = !isExtracting && pageTextContents.length > 0 &&
      pageTextContents.every((p) => p.items.length === 0);

    return (
      <div className="p-4 text-center text-sm">
        {hasNoText ? (
          <div className="text-amber-600">
            <p className="font-medium mb-1">텍스트를 추출할 수 없습니다</p>
            <p className="text-xs text-gray-400">스캔된 이미지 PDF이거나 텍스트가 포함되지 않은 파일입니다.</p>
          </div>
        ) : (
          <p className="text-gray-400">키워드를 검색하면 결과가 여기에 표시됩니다.</p>
        )}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="overflow-auto h-full"
      role="listbox"
      aria-label="검색 결과 목록"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onScroll={handleScroll}
    >
      <div className="p-3 border-b bg-gray-50 sticky top-0 z-10">
        <span className="text-sm font-medium text-gray-700" aria-live="polite">
          검색 결과: {searchResults.length}건
        </span>
        {/* Per-term statistics summary */}
        {hasMultiTerms && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {searchTerms.map((st) => {
              const termResults = searchResults.filter((r) => r.termLabel === st.term);
              const uniquePages = new Set(termResults.map((r) => r.page)).size;
              return (
                <span
                  key={st.id}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: st.color }}
                >
                  {st.term}
                  <span className="opacity-80">{termResults.length}건 / {uniquePages}p</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {virtualItems.slice(startIdx, endIdx).map((item, i) => {
          const idx = startIdx + i;
          if (item.type === 'header') {
            return (
              <div
                key={`h-${item.page}`}
                className="px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-500 border-t"
                style={{ position: 'absolute', top: offsets[idx], height: HEADER_HEIGHT, width: '100%' }}
              >
                페이지 {item.page} ({item.count}건)
              </div>
            );
          }
          const itemH = getVirtualItemHeight(item);
          return (
            <div
              key={item.result.id}
              style={{ position: 'absolute', top: offsets[idx], height: itemH, width: '100%' }}
            >
              <ResultItem
                result={item.result}
                isCurrent={item.globalIndex === currentResultIndex}
                globalIndex={item.globalIndex}
                searchQuery={''}
                onGoToResult={goToResult}
                hasMultiTerms={hasMultiTerms}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
