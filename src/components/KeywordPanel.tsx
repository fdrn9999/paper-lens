'use client';

import { memo, useCallback, useMemo } from 'react';
import useStore from '@/store/useStore';
import type { ExtractedKeyword, KeywordAlgorithm } from '@/lib/types';

const ALGO_TABS: { key: KeywordAlgorithm; label: string }[] = [
  { key: 'tfidf', label: 'TF-IDF' },
  { key: 'textrank', label: 'TextRank' },
  { key: 'ngram', label: 'N-gram' },
];

/** Highlight keyword occurrences within a snippet string. */
function HighlightedSnippet({ snippet, term }: { snippet: string; term: string }) {
  const parts = useMemo(() => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escaped})`, 'gi');
    return snippet.split(re);
  }, [snippet, term]);

  const matchRe = useMemo(() => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped}$`, 'i');
  }, [term]);

  return (
    <span>
      {parts.map((part, i) =>
        matchRe.test(part)
          ? <span key={i} className="font-bold text-gray-900">{part}</span>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

const KeywordCard = memo(function KeywordCard({
  keyword,
  isActive,
  onToggle,
  onPageClick,
}: {
  keyword: ExtractedKeyword;
  isActive: boolean;
  onToggle: (term: string) => void;
  onPageClick: (page: number) => void;
}) {
  const handleClick = useCallback(() => onToggle(keyword.term), [onToggle, keyword.term]);

  const displayPages = keyword.pages.slice(0, 5);
  const extraPages = keyword.pages.length - 5;
  const scorePct = Math.round(keyword.score * 100);

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left rounded-lg border transition-all duration-150 overflow-hidden ${
        isActive
          ? 'ring-1 ring-offset-1 shadow-sm'
          : 'bg-white hover:shadow-sm border-gray-200'
      }`}
      style={isActive ? {
        borderColor: keyword.color,
        backgroundColor: `${keyword.color}10`,
        boxShadow: `0 0 0 1px ${keyword.color}`,
      } : undefined}
      aria-pressed={isActive}
      aria-label={`키워드: ${keyword.term}, 점수: ${scorePct}%`}
    >
      <div className="flex">
        {/* Color bar */}
        <div className="w-1 shrink-0 rounded-l-lg" style={{ backgroundColor: keyword.color }} />

        <div className="flex-1 min-w-0 p-2.5">
          {/* Header: term + badge */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="font-bold text-sm text-gray-900 truncate">{keyword.term}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0 uppercase font-medium tracking-wide">
              {keyword.algorithm}
            </span>
          </div>

          {/* Score bar + frequency */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${scorePct}%`, backgroundColor: keyword.color }}
              />
            </div>
            <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">
              {scorePct}%
            </span>
          </div>
          <div className="text-[10px] text-gray-400 mb-1.5">
            {keyword.frequency}회 ({keyword.frequencyPercent.toFixed(2)}%)
          </div>

          {/* Page badges */}
          {keyword.pages.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {displayPages.map((p) => (
                <button
                  key={p}
                  onClick={(e) => { e.stopPropagation(); onPageClick(p); }}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium"
                >
                  P{p}
                </button>
              ))}
              {extraPages > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 text-gray-400">+{extraPages}</span>
              )}
            </div>
          )}

          {/* Context snippet */}
          {keyword.contexts.length > 0 && (
            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
              <HighlightedSnippet snippet={keyword.contexts[0].snippet} term={keyword.term} />
            </p>
          )}
        </div>
      </div>
    </button>
  );
});

export default memo(function KeywordPanel() {
  const keywords = useStore((s) => s.keywords);
  const keywordAlgorithm = useStore((s) => s.keywordAlgorithm);
  const activeKeywords = useStore((s) => s.activeKeywords);
  const isExtractingKeywords = useStore((s) => s.isExtractingKeywords);
  const keywordProgress = useStore((s) => s.keywordProgress);
  const pdfData = useStore((s) => s.pdfData);
  const pageTextContents = useStore((s) => s.pageTextContents);
  const setKeywordAlgorithm = useStore((s) => s.setKeywordAlgorithm);
  const toggleKeywordHighlight = useStore((s) => s.toggleKeywordHighlight);
  const setCurrentPage = useStore((s) => s.setCurrentPage);

  const handlePageClick = useCallback((page: number) => {
    setCurrentPage(page);
  }, [setCurrentPage]);

  const activeSet = useMemo(() => new Set(activeKeywords), [activeKeywords]);

  // No PDF loaded
  if (!pdfData) return null;

  // Extracting keywords
  if (isExtractingKeywords) {
    const pct = keywordProgress ? Math.round((keywordProgress.current / keywordProgress.total) * 100) : 0;
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        <p className="text-sm text-emerald-600 font-medium">키워드 추출 중...</p>
        <div className="w-full max-w-[200px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // No text extracted yet
  if (pageTextContents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-gray-400 text-center">
          PDF를 업로드하면 키워드가<br />자동으로 추출됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Algorithm tabs */}
      <div className="flex border-b bg-gray-50 shrink-0">
        {ALGO_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setKeywordAlgorithm(tab.key)}
            className={`flex-1 px-1 py-2 text-xs font-medium transition-colors relative ${
              keywordAlgorithm === tab.key
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {keywordAlgorithm === tab.key && (
              <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-2.5">
        {/* Empty state */}
        {(!keywords || keywords.length === 0) && (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-400 text-center">
              추출된 키워드가 없습니다.
            </p>
          </div>
        )}

        {/* Keyword cards grid */}
        {keywords && keywords.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {keywords.map((kw) => (
              <KeywordCard
                key={kw.term}
                keyword={kw}
                isActive={activeSet.has(kw.term)}
                onToggle={toggleKeywordHighlight}
                onPageClick={handlePageClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
