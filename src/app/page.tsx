'use client';

import { useEffect, useCallback } from 'react';
import useStore from '@/store/useStore';
import FileUploader from '@/components/FileUploader';
import PDFViewer from '@/components/PDFViewer';
import SearchBar from '@/components/SearchBar';
import ResultList from '@/components/ResultList';
import PageNavigator from '@/components/PageNavigator';
import TranslationPanel from '@/components/TranslationPanel';
import GuideOverlay from '@/components/GuideOverlay';
import HelpButton from '@/components/HelpButton';
import ErrorBoundary from '@/components/ErrorBoundary';
import ToastContainer from '@/components/Toast';

export default function Home() {
  const pdfData = useStore((s) => s.pdfData);
  const pdfFile = useStore((s) => s.pdfFile);
  const isLoadingPdf = useStore((s) => s.isLoadingPdf);
  const reset = useStore((s) => s.reset);
  const isSidebarOpen = useStore((s) => s.isSidebarOpen);
  const setIsSidebarOpen = useStore((s) => s.setIsSidebarOpen);
  const hasSeenTutorial = useStore((s) => s.hasSeenTutorial);
  const startGuide = useStore((s) => s.startGuide);
  const searchResults = useStore((s) => s.searchResults);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const setShowTranslation = useStore((s) => s.setShowTranslation);
  const viewerMode = useStore((s) => s.viewerMode);

  // Auto-start guide for first-time users after PDF loads
  useEffect(() => {
    if (pdfData && !hasSeenTutorial) {
      const timer = setTimeout(() => startGuide(), 800);
      return () => clearTimeout(timer);
    }
  }, [pdfData, hasSeenTutorial, startGuide]);

  // Prevent browser from opening dropped files in a new tab (only when PDF is loaded)
  useEffect(() => {
    if (!pdfData) return;
    const prevent = (e: DragEvent) => { e.preventDefault(); };
    document.addEventListener('dragover', prevent);
    document.addEventListener('drop', prevent);
    return () => {
      document.removeEventListener('dragover', prevent);
      document.removeEventListener('drop', prevent);
    };
  }, [pdfData]);

  // Global keyboard shortcuts
  useEffect(() => {
    if (!pdfData) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      // Ctrl+F / Cmd+F → focus search bar
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('[data-guide="search-bar"] input') as HTMLInputElement;
        searchInput?.focus();
        return;
      }

      // Escape → close panels (but not when typing in input fields — SearchBar handles its own Escape)
      if (e.key === 'Escape') {
        if (!isInput) {
          setShowTranslation(false);
          setIsSidebarOpen(false);
        }
        return;
      }

      // Skip page navigation if user is typing
      if (isInput) return;

      // Page navigation — mode-specific arrow keys
      const store = useStore.getState();
      const { currentPage: cp, totalPages: tp } = store;

      if (viewerMode === 'scroll') {
        // Scroll mode: Up/Down arrow keys for page navigation
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (cp > 1) setCurrentPage(cp - 1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (cp < tp) setCurrentPage(cp + 1);
        }
      } else {
        // Page mode: Left/Right arrow keys for page navigation
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (cp > 1) setCurrentPage(cp - 1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (cp < tp) setCurrentPage(cp + 1);
        }
      }

      // Shared shortcuts (both modes)
      if (e.key === 'PageUp') {
        e.preventDefault();
        if (cp > 1) setCurrentPage(cp - 1);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        if (cp < tp) setCurrentPage(cp + 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentPage(tp);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pdfData, viewerMode, setCurrentPage, setShowTranslation, setIsSidebarOpen]);

  const goHome = useCallback(() => reset(), [reset]);

  // Landing view
  if (!pdfData && !isLoadingPdf) {
    return (
      <div className="min-h-[100dvh] flex flex-col overflow-y-auto fixed inset-0 max-w-[100vw] overflow-x-hidden">
        <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b bg-white">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="PaperLens 로고" className="w-7 h-7" />
            <h1 className="text-xl font-bold text-gray-800">PaperLens</h1>
          </div>
          <p className="text-sm text-gray-500 hidden sm:block">AI 기반 논문 탐색 도구</p>
          <HelpButton />
        </header>
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-xl space-y-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                PDF 논문을 업로드하면 AI가 문서를 분석합니다.<br className="hidden sm:inline" />
                키워드 검색, 의미 기반 AI 검색, 드래그 번역으로 논문을 빠르게 탐색하세요.
              </p>
            </div>
            <FileUploader />
          </div>
        </main>
        <footer className="py-4 pb-safe flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-400 px-4">
          <span className="whitespace-nowrap">Made by 정진호(fdrn9999)</span>
          <a href="https://github.com/fdrn9999" target="_blank" rel="noopener noreferrer"
             className="whitespace-nowrap hover:text-gray-600 transition-colors">GitHub</a>
          <a href="mailto:ckato9173@gmail.com"
             className="whitespace-nowrap hover:text-gray-600 transition-colors">ckato9173@gmail.com</a>
          <span className="text-gray-300">|</span>
          <a href="/privacy"
             className="whitespace-nowrap hover:text-gray-600 transition-colors">개인정보처리방침</a>
        </footer>
      </div>
    );
  }

  // Loading view
  if (isLoadingPdf && !pdfData) {
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
          <p className="text-gray-600">PDF 로딩 중...</p>
        </div>
      </div>
    );
  }

  // Main app view
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden max-w-[100vw]">
      <a href="#main-content" className="skip-to-content">본문으로 건너뛰기</a>
      {/* Guide overlay */}
      <GuideOverlay />
      <ToastContainer />

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3 border-b bg-white shadow-sm z-40">
        {/* Top row on mobile: hamburger + logo + close + help; on sm+ these flow inline via `contents` */}
        <div className="flex items-center gap-2 sm:flex sm:gap-2 sm:shrink-0">
          {/* Hamburger (mobile + tablet) */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="relative lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-gray-100 transition-colors shrink-0"
            aria-label="검색 결과 패널"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {searchResults.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {searchResults.length > 99 ? '99' : searchResults.length}
              </span>
            )}
          </button>

          <button onClick={goHome} className="flex items-center gap-2 shrink-0 hover:opacity-70 transition-opacity" title="처음으로 돌아가기">
            <img src="/favicon.svg" alt="PaperLens 로고" className="w-5 h-5" draggable={false} />
            <h1 className="text-base sm:text-lg font-bold text-gray-800 hidden sm:inline">PaperLens</h1>
          </button>

          {pdfFile && (
            <>
              {/* Tablet/Desktop: filename + close */}
              <div className="items-center gap-2 shrink-0 text-sm text-gray-500 border-l pl-2 sm:pl-4 hidden sm:flex">
                <span className="truncate max-w-[80px] sm:max-w-[120px] md:max-w-[200px] lg:max-w-[300px]">{pdfFile.name}</span>
                <button
                  onClick={reset}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="파일 닫기"
                  aria-label="파일 닫기"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Mobile: close button only */}
              <button
                onClick={reset}
                className="sm:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                title="파일 닫기"
                aria-label="파일 닫기"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}

          {/* Spacer pushes HelpButton to right edge on mobile top row */}
          <div className="flex-1 sm:hidden" />

          {/* HelpButton in mobile top row */}
          <div className="sm:hidden">
            <HelpButton />
          </div>
        </div>

        {/* SearchBar: full-width second row on mobile, inline flex-1 on sm+ */}
        <div data-guide="search-bar" className="flex-1 min-w-0">
          <SearchBar />
        </div>

        {/* HelpButton for sm+ (hidden on mobile, shown in top row instead) */}
        <div className="hidden sm:block shrink-0">
          <HelpButton />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Backdrop (mobile + tablet) */}
        {isSidebarOpen && (
          <div
            className="absolute inset-0 bg-black/30 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar - drawer on mobile/tablet, fixed on PC */}
        <aside
          role="complementary"
          aria-label="검색 결과 사이드바"
          className={`
            absolute inset-y-0 left-0 z-[35] w-[85vw] max-w-[288px] bg-white border-r flex flex-col shrink-0
            transform transition-transform duration-200 ease-out
            lg:relative lg:translate-x-0 lg:w-72 lg:max-w-none
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          {/* Sidebar header (mobile + tablet) */}
          <div className="flex items-center justify-between px-3 py-2 border-b lg:hidden">
            <span className="text-sm font-medium text-gray-700">검색 결과</span>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-gray-100"
              aria-label="사이드바 닫기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ResultList />
        </aside>

        {/* Main - PDF Viewer */}
        <main id="main-content" className="flex-1 min-w-0 flex flex-col overflow-hidden" data-guide="pdf-viewer">
          <ErrorBoundary
            section="PDF 뷰어"
            fallback={
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center bg-gray-100">
                <div className="text-5xl">📄</div>
                <h2 className="text-lg font-semibold text-gray-800">PDF를 표시할 수 없습니다</h2>
                <p className="text-sm text-gray-500">파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.</p>
                <button
                  onClick={reset}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  다른 파일 열기
                </button>
              </div>
            }
          >
            <div className="flex-1 overflow-hidden">
              <PDFViewer />
            </div>
          </ErrorBoundary>
          <PageNavigator />
        </main>
      </div>

      {/* Bottom - Translation */}
      <ErrorBoundary
        section="번역"
        fallback={
          <div className="border-t bg-white px-4 py-3 text-center">
            <p className="text-sm text-gray-500">번역 기능에 오류가 발생했습니다.</p>
          </div>
        }
      >
        <TranslationPanel />
      </ErrorBoundary>
    </div>
  );
}
