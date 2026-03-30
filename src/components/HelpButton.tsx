'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import useStore from '@/store/useStore';

export default function HelpButton() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startGuide = useStore((s) => s.startGuide);
  const pdfData = useStore((s) => s.pdfData);
  const viewerMode = useStore((s) => s.viewerMode);
  const isScrollMode = useMemo(() => viewerMode === 'scroll', [viewerMode]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border text-sm font-bold transition-colors
          ${isOpen
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50 hover:text-gray-700'}`}
        title="도움말"
        aria-label="도움말 열기"
        aria-expanded={isOpen}
      >
        ?
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in">
          <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
            <h3 className="font-bold text-gray-800">PaperLens 사용 가이드</h3>
            <p className="text-xs text-gray-500 mt-1">논문을 탐색하는 새로운 방법</p>
          </div>

          <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
            {/* Search modes */}
            <section>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</span>
                검색 모드
              </h4>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex gap-2">
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium shrink-0">정확</span>
                  <span>입력한 단어와 <strong>정확히 일치</strong>하는 결과를 찾습니다. Ctrl+F와 유사하지만 단어 단위로 매칭합니다.</span>
                </div>
                <div className="flex gap-2">
                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium shrink-0">AI 분석</span>
                  <span>사이드바 AI 탭에서 <strong>논문 자동 요약</strong>과 <strong>질문 답변</strong> 챗봇을 이용할 수 있습니다.</span>
                </div>
              </div>
            </section>

            {/* Translation */}
            <section>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">2</span>
                드래그 번역
              </h4>
              <p className="text-xs text-gray-600">
                PDF 위의 텍스트를 드래그하면 번역 버튼이 나타납니다. 클릭하면 Gemini AI가 한국어로 번역합니다.
              </p>
            </section>

            {/* Keyboard shortcuts */}
            <section>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">3</span>
                키보드 단축키
              </h4>
              <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-600">
                <div><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Enter</kbd> 다음 결과</div>
                <div><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Shift+Enter</kbd> 이전</div>
                <div><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Esc</kbd> 검색 초기화</div>
                <div><span className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Aa</span> 버튼: 대소문자 구분</div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-1.5 text-xs text-gray-600">
                <div><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+1</kbd> 검색 탭</div>
                <div><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+2</kbd> 키워드 탭</div>
                <div><kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+3</kbd> AI 탭</div>
              </div>
              {/* Mode-specific page navigation keys */}
              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1 text-xs">
                <div className={`flex items-center gap-1.5 ${isScrollMode ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                  <kbd className={`px-1 py-0.5 rounded text-[10px] font-mono ${isScrollMode ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>↑↓</kbd>
                  <span>페이지 이동 (스크롤 모드)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${!isScrollMode ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                  <kbd className={`px-1 py-0.5 rounded text-[10px] font-mono ${!isScrollMode ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>←→</kbd>
                  <span>페이지 이동 (페이지 모드)</span>
                </div>
              </div>
            </section>

            {/* Usage limits */}
            <section>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">4</span>
                사용 제한
              </h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p>AI 분석과 번역은 글자 수 기반 일일 사용량이 제한됩니다. 사용량은 헤더의 사용량 버튼에서 퍼센트로 확인할 수 있습니다.</p>
                <p className="text-gray-400">제한은 매일 자정(KST, 한국시간)에 초기화됩니다.</p>
              </div>
            </section>

            {/* Keyword extraction */}
            <section>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">5</span>
                키워드 자동 추출
              </h4>
              <div className="text-xs text-gray-600 space-y-1.5">
                <p>사이드바의 <strong>&lsquo;키워드&rsquo;</strong> 탭으로 전환하면 PDF에서 자동 추출된 핵심 키워드를 확인할 수 있습니다.</p>
                <div className="space-y-1 pl-2 border-l-2 border-blue-100">
                  <p><strong>TF-IDF</strong> — 문서 내 빈도 기반 핵심 용어 추출</p>
                  <p><strong>TextRank</strong> — 단어 간 관계 그래프 기반 추출</p>
                  <p><strong>N-gram</strong> — 복합 명사/구문 패턴 추출</p>
                </div>
                <p>키워드 카드를 클릭하면 PDF에서 해당 키워드가 고유 색상으로 하이라이트됩니다.</p>
                <p className="text-gray-400">키워드 카드의 검색 아이콘을 클릭하면 해당 키워드를 검색어에 추가할 수 있습니다.</p>
              </div>
            </section>
          </div>

          {/* Replay tutorial button */}
          {pdfData && (
            <div className="p-3 border-t bg-gray-50">
              <button
                onClick={() => { startGuide(); setIsOpen(false); }}
                className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                튜토리얼 다시 보기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
