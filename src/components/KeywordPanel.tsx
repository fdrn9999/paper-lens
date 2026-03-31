'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import useStore from '@/store/useStore';
import type { ExtractedKeyword, KeywordAlgorithm } from '@/lib/types';

const ALGO_TABS: { key: KeywordAlgorithm; label: string }[] = [
  { key: 'tfidf', label: 'TF-IDF' },
  { key: 'textrank', label: 'TextRank' },
  { key: 'ngram', label: 'N-gram CNN' },
];

const ALGO_INFO: Record<KeywordAlgorithm, {
  icon: string;
  title: string;
  description: string;
  howItWorks: string;
  bestFor: string;
}> = {
  tfidf: {
    icon: '\u{1F4CA}',
    title: 'TF-IDF (Term Frequency-Inverse Document Frequency)',
    description: '단어의 빈도(TF)와 희소성(IDF)을 결합하여 중요도를 계산합니다.',
    howItWorks: '문서에서 자주 등장하지만(TF\u2191), 다른 페이지에서는 드물게 나타나는(IDF\u2191) 단어일수록 높은 점수를 받습니다.',
    bestFor: '특정 주제에 집중된 전문 용어 발견',
  },
  textrank: {
    icon: '\u{1F517}',
    title: 'TextRank (Graph-based Ranking)',
    description: 'Google PageRank와 유사한 그래프 알고리즘으로 키워드를 순위화합니다.',
    howItWorks: '단어들의 동시출현 관계를 그래프로 구성하고, 다른 중요 단어들과 자주 함께 나타나는 단어가 높은 점수를 받습니다.',
    bestFor: '문맥적으로 핵심적인 단어 발견',
  },
  ngram: {
    icon: '\u{1F524}',
    title: 'N-gram CNN (CNN 영감 다중 필터 추출)',
    description: 'TextCNN의 다중 필터 아이디어에서 영감받아, 다양한 길이의 N-gram 패턴을 추출합니다.',
    howItWorks: 'CNN의 다양한 크기 필터 개념을 차용하여 unigram, bigram, trigram을 동시에 스캔하고, 길이별 가중치(1x, 1.5x, 2x)를 적용합니다. 신경망 학습 기반이 아닌 통계적 패턴 매칭 방식입니다.',
    bestFor: '복합 명사, 기술 용어 등 다단어 핵심 표현 발견',
  },
};

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
  onAddToSearch,
  onSwitchToSearch,
}: {
  keyword: ExtractedKeyword;
  isActive: boolean;
  onToggle: (term: string) => void;
  onPageClick: (page: number) => void;
  onAddToSearch: (term: string) => void;
  onSwitchToSearch: (tab: 'search') => void;
}) {
  const handleClick = useCallback(() => onToggle(keyword.term), [onToggle, keyword.term]);

  const [showAllPages, setShowAllPages] = useState(false);
  const displayPages = showAllPages ? keyword.pages : keyword.pages.slice(0, 5);
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
            {keyword.tag && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 shrink-0 font-medium">
                {keyword.tag}
              </span>
            )}
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0 uppercase font-medium tracking-wide">
              {keyword.algorithm}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onAddToSearch(keyword.term); onSwitchToSearch('search'); window.dispatchEvent(new CustomEvent('paperlens-toast', { detail: { text: `"${keyword.term}" 검색어에 추가됨`, type: 'success' } })); }}
              className="ml-auto shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
              title="검색에 추가"
              aria-label={`${keyword.term} 검색에 추가`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
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
                  className="text-[10px] px-2 py-1 min-h-[24px] rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium"
                >
                  P{p}
                </button>
              ))}
              {extraPages > 0 && !showAllPages && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAllPages(true); }}
                  className="text-[10px] px-2 py-1 min-h-[24px] rounded bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors font-medium"
                >
                  +{extraPages}
                </button>
              )}
              {showAllPages && keyword.pages.length > 5 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAllPages(false); }}
                  className="text-[10px] px-2 py-1 min-h-[24px] rounded bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors font-medium"
                >
                  접기
                </button>
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
  const toggleAllKeywordHighlights = useStore((s) => s.toggleAllKeywordHighlights);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const addSearchTerm = useStore((s) => s.addSearchTerm);
  const setSidebarTab = useStore((s) => s.setSidebarTab);

  const [showAlgoInfo, setShowAlgoInfo] = useState(false);

  const handlePageClick = useCallback((page: number) => {
    setCurrentPage(page);
  }, [setCurrentPage]);

  const activeSet = useMemo(() => new Set(activeKeywords), [activeKeywords]);

  const algoInfo = ALGO_INFO[keywordAlgorithm];

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

      {/* Toolbar */}
      {keywords && keywords.length > 0 && (
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b bg-white shrink-0">
          <span className="text-[10px] text-gray-400">{keywords.length}개 키워드</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowAlgoInfo((v) => !v)}
              className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-colors ${
                showAlgoInfo
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
              }`}
              title="알고리즘 설명 보기"
            >
              ?
            </button>
            <button
              onClick={toggleAllKeywordHighlights}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-colors min-h-[32px] ${
                activeKeywords.length > 0
                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={activeKeywords.length > 0 ? '모든 하이라이트 끄기' : '모든 하이라이트 켜기'}
            >
              {/* Eye icon */}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {activeKeywords.length > 0 ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                )}
              </svg>
              {activeKeywords.length > 0 ? '하이라이트 끄기' : '하이라이트 켜기'}
            </button>
          </div>
        </div>
      )}

      {/* Algorithm info card */}
      {showAlgoInfo && (
        <div className="mx-2.5 mt-2 mb-1 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-lg">{algoInfo.icon}</span>
            <div>
              <h4 className="text-xs font-bold text-gray-800">{algoInfo.title}</h4>
              <p className="text-[11px] text-gray-600 mt-0.5">{algoInfo.description}</p>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 space-y-1.5 ml-7">
            <div>
              <span className="font-semibold text-gray-600">작동 원리: </span>
              {algoInfo.howItWorks}
            </div>
            <div>
              <span className="font-semibold text-emerald-600">적합한 용도: </span>
              {algoInfo.bestFor}
            </div>
          </div>
        </div>
      )}

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
                onAddToSearch={addSearchTerm}
                onSwitchToSearch={setSidebarTab}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
