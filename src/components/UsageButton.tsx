'use client';

import { useState, useRef, useEffect } from 'react';
import useStore from '@/store/useStore';

function UsageBar({ label, usedPercent, usedChars, limitChars }: {
  label: string;
  usedPercent: number;
  usedChars: number;
  limitChars: number;
}) {
  const pct = Math.min(usedPercent, 100);
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className={`text-xs font-bold tabular-nums ${textColor}`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {limitChars > 0 && (
        <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
          {usedChars.toLocaleString()} / {limitChars.toLocaleString()} 글자
        </p>
      )}
    </div>
  );
}

export default function UsageButton() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const chatQuota = useStore((s) => s.chatQuota);
  const translateQuota = useStore((s) => s.translateQuota);

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

  const maxPct = Math.max(chatQuota?.usedPercent ?? 0, translateQuota?.usedPercent ?? 0);
  const indicatorColor = maxPct >= 90 ? 'text-red-500' : maxPct >= 70 ? 'text-amber-500' : 'text-gray-500';

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border text-sm transition-colors
          ${isOpen
            ? 'bg-blue-600 text-white border-blue-600'
            : `bg-white ${indicatorColor} border-gray-300 hover:bg-gray-50 hover:text-gray-700`}`}
        title="사용량"
        aria-label="사용량 확인"
        aria-expanded={isOpen}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v8H3zM9 9h2v12H9zM15 5h2v16h-2zM21 1h2v20h-2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in">
          <div className="p-3 border-b bg-gradient-to-r from-blue-50 to-emerald-50">
            <h3 className="text-sm font-bold text-gray-800">일일 사용량</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">매일 자정(한국시간) 초기화</p>
          </div>

          <div className="p-3 space-y-3">
            <UsageBar
              label="AI 분석"
              usedPercent={chatQuota?.usedPercent ?? 0}
              usedChars={chatQuota?.usedChars ?? 0}
              limitChars={chatQuota?.limitChars ?? 0}
            />
            <UsageBar
              label="번역"
              usedPercent={translateQuota?.usedPercent ?? 0}
              usedChars={translateQuota?.usedChars ?? 0}
              limitChars={translateQuota?.limitChars ?? 0}
            />
            {!chatQuota && !translateQuota && (
              <p className="text-xs text-gray-400 text-center py-2">
                아직 사용 기록이 없습니다.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
