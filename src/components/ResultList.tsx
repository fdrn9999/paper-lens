'use client';

import { useCallback, useMemo, useRef, useState, memo, useEffect } from 'react';
import useStore from '@/store/useStore';
import type { SearchResult } from '@/lib/types';
import { getEmbeddingMessage } from '@/lib/messages';

const ITEM_HEIGHT = 44;
const SEMANTIC_ITEM_HEIGHT = 60;
const HEADER_HEIGHT = 28;
const OVERSCAN = 10;

type VirtualItem =
  | { type: 'header'; page: number; count: number }
  | { type: 'result'; result: SearchResult; globalIndex: number };

function isSemantic(r: SearchResult): boolean {
  return r.semantic === true;
}

function getVirtualItemHeight(item: VirtualItem): number {
  if (item.type === 'header') return HEADER_HEIGHT;
  return isSemantic(item.result) ? SEMANTIC_ITEM_HEIGHT : ITEM_HEIGHT;
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
      <p className="text-gray-700 leading-relaxed truncate">
        {result.context.slice(0, 60)}{result.context.length > 60 ? '...' : ''}
      </p>
    );
  }

  const before = result.context.slice(0, match.start);
  const highlighted = result.context.slice(match.start, match.end);
  const after = result.context.slice(match.end);

  return (
    <p className="text-gray-700 leading-relaxed truncate">
      {before.length > 30
        ? '...' + before.slice(-30)
        : before}
      <span className={`font-bold ${isCurrent ? 'text-orange-600' : 'text-yellow-600'}`}>
        {highlighted}
      </span>
      {after.length > 30
        ? after.slice(0, 30) + '...'
        : after}
    </p>
  );
}

/** Highlight query keywords within semantic result context. */
function SemanticContext({ context, query, isCurrent }: { context: string; query: string; isCurrent: boolean }) {
  const words = query.trim().split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) {
    return <span>{context.slice(0, 120)}{context.length > 120 ? '...' : ''}</span>;
  }
  const splitPattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const matchPattern = new RegExp(`^(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`, 'i');
  const parts = context.slice(0, 150).split(splitPattern);
  return (
    <span>
      {parts.map((part, i) =>
        matchPattern.test(part)
          ? <span key={i} className={`font-semibold ${isCurrent ? 'text-orange-600' : 'text-blue-600'}`}>{part}</span>
          : <span key={i}>{part}</span>
      )}
      {context.length > 150 ? '...' : ''}
    </span>
  );
}

function RelevanceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'text-green-600 bg-green-50' : pct >= 60 ? 'text-blue-600 bg-blue-50' : 'text-gray-500 bg-gray-50';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${color}`}>
      {pct}%
    </span>
  );
}

const ResultItem = memo(function ResultItem({
  result,
  isCurrent,
  globalIndex,
  searchQuery,
  onGoToResult,
}: {
  result: SearchResult;
  isCurrent: boolean;
  globalIndex: number;
  searchQuery: string;
  onGoToResult: (idx: number) => void;
}) {
  const handleClick = useCallback(() => onGoToResult(globalIndex), [onGoToResult, globalIndex]);
  const semantic = isSemantic(result);

  return (
    <button
      role="option"
      aria-selected={isCurrent}
      aria-label={`페이지 ${result.page}: ${result.matchedToken}`}
      onClick={handleClick}
      className={`w-full h-full text-left px-3 py-2 text-sm transition-colors
        ${isCurrent
          ? 'bg-orange-50 border-l-2 border-orange-400'
          : 'hover:bg-gray-50 border-l-2 border-transparent'
        }`}
    >
      {semantic ? (
        <div className="flex items-start gap-1.5">
          <p className="text-gray-700 leading-relaxed line-clamp-2 flex-1 min-w-0">
            <SemanticContext context={result.context} query={searchQuery} isCurrent={isCurrent} />
          </p>
          {result.relevanceScore != null && <RelevanceBadge score={result.relevanceScore} />}
        </div>
      ) : (
        <HighlightedContext result={result} isCurrent={isCurrent} />
      )}
    </button>
  );
});

export default memo(function ResultList() {
  const searchResults = useStore((s) => s.searchResults);
  const currentResultIndex = useStore((s) => s.currentResultIndex);
  const searchQuery = useStore((s) => s.searchQuery);
  const searchMode = useStore((s) => s.searchMode);
  const goToResult = useStore((s) => s.goToResult);
  const nextResult = useStore((s) => s.nextResult);
  const prevResult = useStore((s) => s.prevResult);
  const pdfData = useStore((s) => s.pdfData);
  const isEmbedding = useStore((s) => s.isEmbedding);
  const embeddingProgress = useStore((s) => s.embeddingProgress);
  const isExtracting = useStore((s) => s.isExtracting);
  const pageTextContents = useStore((s) => s.pageTextContents);

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

  if (isEmbedding || (embeddingProgress && searchResults.length === 0)) {
    const progressPct = embeddingProgress?.code === 'ANALYZING' && embeddingProgress.total
      ? Math.round((embeddingProgress.current ?? 0) / embeddingProgress.total * 100)
      : null;
    return (
      <div className="p-6 flex flex-col items-center gap-3 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
        <p className="text-sm text-purple-600 font-medium">{getEmbeddingMessage(embeddingProgress) || '처리 중...'}</p>
        {progressPct !== null && (
          <div className="w-full max-w-[200px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
        <p className="text-xs text-gray-400">
          {embeddingProgress?.code === 'ANALYZING' ? '문서 임베딩 생성 중...' :
           embeddingProgress?.code === 'COMPARING_KEYWORD' ? '검색어와 비교 중...' :
           'AI가 문서를 분석하고 있습니다'}
        </p>
      </div>
    );
  }

  if (isExtracting && searchResults.length === 0 && !searchQuery) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        <div className="animate-pulse">텍스트 추출 중...</div>
      </div>
    );
  }

  if (searchResults.length === 0 && searchQuery) {
    const searchModeVal = searchMode;
    return (
      <div className="p-4 text-center text-sm">
        {isExtracting ? (
          <div className="text-amber-600">
            <p>&quot;{searchQuery}&quot; 검색 중...</p>
            <p className="text-xs text-gray-400 mt-1">
              텍스트 추출이 진행 중이므로 결과가 추가될 수 있습니다 ({pageTextContents.length}페이지 완료)
            </p>
          </div>
        ) : (
          <div className="text-gray-500">
            <p>&quot;{searchQuery}&quot;에 대한 검색 결과가 없습니다.</p>
            <div className="mt-2 text-xs text-gray-400 space-y-1">
              {searchModeVal === 'exact' ? (
                <>
                  <p>AI 검색으로 전환하면 의미가 유사한 문장도 찾을 수 있습니다.</p>
                  <p>대소문자 구분이 켜져 있다면 끄고 시도해 보세요.</p>
                </>
              ) : (
                <>
                  <p>다른 표현이나 키워드로 검색해 보세요.</p>
                  <p>정확 검색으로 전환하면 특정 단어를 직접 찾을 수 있습니다.</p>
                </>
              )}
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
                searchQuery={isSemantic(item.result) ? searchQuery : ''}
                onGoToResult={goToResult}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
