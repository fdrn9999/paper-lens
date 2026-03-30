'use client';

import { useEffect, useState, useCallback } from 'react';
import useStore from '@/store/useStore';

const GUIDE_STEPS = [
  {
    title: 'PaperLens에 오신 것을 환영합니다! 👋',
    content:
      '논문 PDF를 업로드하고, AI 기반 검색과 번역으로\n논문을 빠르게 탐색해보세요.',
    target: null,
    position: 'center' as const,
  },
  {
    title: '🔍 검색 모드 선택',
    content:
      'Exact: 정확한 단어 일치 검색 (빠름)\nAI: 의미 기반 검색 — "AI"로 검색하면\n"Artificial Intelligence"도 함께 찾아줍니다.',
    target: '[data-guide="search-mode"]',
    position: 'bottom' as const,
  },
  {
    title: '⚡ AI 검색 준비',
    content:
      'AI 모드는 문서 업로드 후 임베딩 분석이\n완료되어야 사용할 수 있습니다.\n분석 중에는 버튼이 비활성화됩니다.',
    target: '[data-guide="search-bar"]',
    position: 'bottom' as const,
  },
  {
    title: '🌐 드래그 번역',
    content:
      'PDF 위의 텍스트를 마우스로 드래그하면\n플로팅 번역 버튼이 나타납니다.\n클릭하면 Gemini AI가 한국어로 번역해줍니다.',
    target: '[data-guide="pdf-viewer"]',
    position: 'top' as const,
  },
  {
    title: '🏷️ 키워드 자동 추출',
    content:
      'PDF 업로드 시 자동으로 핵심 키워드를 추출합니다.\n카드를 클릭하면 PDF에서 해당 키워드가\n색상으로 하이라이트됩니다.',
    target: '[data-guide="keyword-tab"]',
    position: 'bottom' as const,
  },
  {
    title: '📖 뷰어 모드',
    content: '__VIEWER_MODE__',
    target: '[data-guide="viewer-mode"]',
    position: 'top' as const,
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function ArrowKey({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center w-7 h-6 rounded text-[10px] font-mono border ${
        disabled
          ? 'bg-gray-100 text-gray-300 border-gray-200 line-through'
          : 'bg-gray-100 text-gray-700 border-gray-300'
      }`}
    >
      {label}
    </kbd>
  );
}

function ViewerModeGuideContent() {
  const viewerMode = useStore((s) => s.viewerMode);
  const isScroll = viewerMode === 'scroll';

  return (
    <div className="text-sm text-gray-600 leading-relaxed mb-4 space-y-3">
      {/* Scroll mode */}
      <div className={`flex items-start gap-2 p-2 rounded-lg ${isScroll ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`}>
        <svg className={`w-4 h-4 shrink-0 mt-0.5 ${isScroll ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="2" width="16" height="7" rx="1" strokeWidth={1.5} />
          <rect x="4" y="11" width="16" height="7" rx="1" strokeWidth={1.5} />
          <path strokeLinecap="round" strokeWidth={1.5} d="M12 20v2M12 20l-2-1.5M12 20l2-1.5" />
        </svg>
        <div>
          <span className={`font-semibold ${isScroll ? 'text-blue-700' : 'text-gray-500'}`}>스크롤 모드</span>
          <div className="flex items-center gap-1 mt-1">
            <ArrowKey label="↑" />
            <ArrowKey label="↓" />
            <span className="text-xs ml-1">페이지 이동</span>
            <span className="mx-1 text-gray-300">|</span>
            <ArrowKey label="←" disabled />
            <ArrowKey label="→" disabled />
          </div>
        </div>
      </div>

      {/* Page mode */}
      <div className={`flex items-start gap-2 p-2 rounded-lg ${!isScroll ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`}>
        <svg className={`w-4 h-4 shrink-0 mt-0.5 ${!isScroll ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="3" width="16" height="18" rx="1.5" strokeWidth={1.5} />
          <path strokeLinecap="round" strokeWidth={1.5} d="M8 8h8M8 12h8M8 16h5" />
        </svg>
        <div>
          <span className={`font-semibold ${!isScroll ? 'text-blue-700' : 'text-gray-500'}`}>페이지 모드</span>
          <div className="flex items-center gap-1 mt-1">
            <ArrowKey label="←" />
            <ArrowKey label="→" />
            <span className="text-xs ml-1">페이지 이동</span>
            <span className="mx-1 text-gray-300">|</span>
            <ArrowKey label="↑" disabled />
            <ArrowKey label="↓" disabled />
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400">하단 바에서 모드를 전환할 수 있습니다.</p>
    </div>
  );
}

export default function GuideOverlay() {
  const isGuideActive = useStore((s) => s.isGuideActive);
  const tutorialStep = useStore((s) => s.tutorialStep);
  const nextGuideStep = useStore((s) => s.nextGuideStep);
  const skipGuide = useStore((s) => s.skipGuide);

  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const step = GUIDE_STEPS[tutorialStep];
    if (!step || !step.target) {
      setSpotlight(null);
      return;
    }

    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) {
      setSpotlight(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const padding = 8;
    setSpotlight({
      top: rect.top - padding,
      left: Math.max(0, rect.left - padding),
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Position tooltip — use dynamic width/height for mobile
    const tooltipWidth = Math.min(340, window.innerWidth - 32);
    const isViewerStep = step.content === '__VIEWER_MODE__';
    const tooltipHeight = isViewerStep ? 400 : 220;
    let top = 0;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    if (step.position === 'bottom') {
      top = rect.bottom + 16;
    } else if (step.position === 'top') {
      top = rect.top - tooltipHeight - 16;
    }

    // Clamp to viewport
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12));

    setTooltipPos({ top, left });
  }, [tutorialStep]);

  useEffect(() => {
    if (!isGuideActive) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isGuideActive, tutorialStep, updatePosition]);

  if (!isGuideActive) return null;

  const step = GUIDE_STEPS[tutorialStep];
  if (!step) return null;

  const isCenter = step.position === 'center' || !spotlight;
  const isLast = tutorialStep === GUIDE_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="사용 가이드">
      {/* Backdrop — only shown when there's no spotlight (welcome screen).
          When spotlight is active, the boxShadow handles dimming to avoid double-opacity. */}
      <div
        className={`absolute inset-0 transition-opacity ${spotlight ? '' : 'bg-black/60'}`}
        onClick={skipGuide}
      />

      {/* Spotlight cutout — boxShadow creates the dim with a transparent hole */}
      {spotlight && (
        <div
          className="absolute rounded-lg transition-all duration-300 ease-out"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
            zIndex: 101,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip / Modal */}
      {isCenter ? (
        /* Welcome modal (centered) */
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 102 }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-[calc(100vw-2rem)] sm:max-w-sm mx-4 text-center animate-in zoom-in">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3">{step.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mb-6">
              {step.content}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={skipGuide}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                건너뛰기
              </button>
              <button
                onClick={() => nextGuideStep(GUIDE_STEPS.length)}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg
                           hover:bg-blue-700 transition-colors font-medium"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Step tooltip (positioned) */
        <div
          className="absolute bg-white rounded-xl shadow-2xl p-5 max-w-[min(300px,calc(100vw-1.5rem))] sm:max-w-[min(340px,calc(100vw-2rem))] animate-in fade-in"
          style={{ top: tooltipPos.top, left: tooltipPos.left, zIndex: 102 }}
        >
          <h3 className="text-base font-bold text-gray-800 mb-2">{step.title}</h3>
          {step.content === '__VIEWER_MODE__' ? (
            <ViewerModeGuideContent />
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mb-4">
              {step.content}
            </p>
          )}

          {/* Step indicator */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {GUIDE_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === tutorialStep ? 'bg-blue-600' : i < tutorialStep ? 'bg-blue-300' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={skipGuide}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                건너뛰기
              </button>
              <button
                onClick={() => nextGuideStep(GUIDE_STEPS.length)}
                className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg
                           hover:bg-blue-700 transition-colors font-medium"
              >
                {isLast ? '완료' : '다음'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
