'use client';

import { memo, useCallback, useState, useEffect } from 'react';
import useStore from '@/store/useStore';
import { getTranslationErrorMessage } from '@/lib/messages';
import type { TranslationErrorCode } from '@/lib/types';
import QuotaIndicator from '@/components/QuotaIndicator';

export default memo(function TranslationPanel() {
  const selectedText = useStore((s) => s.selectedText);
  const translationResult = useStore((s) => s.translationResult);
  const isTranslating = useStore((s) => s.isTranslating);
  const showTranslation = useStore((s) => s.showTranslation);
  const setShowTranslation = useStore((s) => s.setShowTranslation);
  const isTranslationError = useStore((s) => s.isTranslationError);
  const translationErrorCode = useStore((s) => s.translationErrorCode);
  const translationErrorDetail = useStore((s) => s.translationErrorDetail);
  const translate = useStore((s) => s.translate);
  const translateQuota = useStore((s) => s.translateQuota);
  const retryAvailableAt = useStore((s) => s.translateRetryAt);
  const pdfData = useStore((s) => s.pdfData);

  const [retrySec, setRetrySec] = useState(0);
  useEffect(() => {
    if (!retryAvailableAt) { setRetrySec(0); return; }
    const tick = () => setRetrySec(Math.max(0, Math.ceil((retryAvailableAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [retryAvailableAt]);

  const handleRetry = useCallback(() => {
    if (selectedText && retrySec <= 0) translate(selectedText);
  }, [selectedText, translate, retrySec]);

  if (!pdfData || !showTranslation) return null;

  return (
    <div className="bg-white border-t pb-safe shrink-0 max-h-[40dvh] overflow-auto">
      <div className="px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-700">번역 결과</h3>
            {translateQuota && (
              <QuotaIndicator label="번역" usedPercent={translateQuota.usedPercent} color="blue" compact />
            )}
          </div>
          <button
            onClick={() => setShowTranslation(false)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="닫기"
            aria-label="번역 패널 닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Original */}
        <div className="mb-2">
          <p className="text-xs text-gray-500 mb-1">원문</p>
          <p className="text-xs sm:text-sm text-gray-700 bg-gray-50 rounded-lg p-2 max-h-10 sm:max-h-20 overflow-auto">
            {selectedText}
          </p>
        </div>

        {/* Translated */}
        <div>
          <p className="text-xs text-gray-500 mb-1">한국어</p>
          {isTranslating ? (
            <div className="flex items-center gap-2 p-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span className="text-sm text-gray-500">번역 중...</span>
            </div>
          ) : isTranslationError ? (
            <div className="flex items-center justify-between bg-red-50 rounded-lg p-2">
              <p role="alert" className="text-sm text-red-600">
                {translationErrorCode ? getTranslationErrorMessage(translationErrorCode as TranslationErrorCode, translationErrorDetail) : translationResult}
              </p>
              <button
                onClick={handleRetry}
                disabled={retrySec > 0}
                className="ml-3 px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {retrySec > 0 ? `${retrySec}초 후 재시도` : '재시도'}
              </button>
            </div>
          ) : (
            <div className="relative">
              <p className="translation-result text-sm text-gray-900 bg-blue-50 rounded-lg p-2 pr-8 overflow-auto leading-relaxed">
                {translationResult || '번역 결과가 없습니다.'}
              </p>
              {translationResult && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(translationResult);
                    window.dispatchEvent(new CustomEvent('paperlens-toast', { detail: { text: '복사되었습니다.', type: 'success' } }));
                  }}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-gray-600 transition-colors"
                  title="복사"
                  aria-label="번역 결과 복사"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
