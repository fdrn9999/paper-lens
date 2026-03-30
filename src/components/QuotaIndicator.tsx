'use client';

import { memo } from 'react';

interface QuotaIndicatorProps {
  label: string;
  usedPercent: number;
  color?: 'blue' | 'purple';
  compact?: boolean;
}

export default memo(function QuotaIndicator({ label, usedPercent, color = 'blue', compact = false }: QuotaIndicatorProps) {
  const percentage = Math.min(100, Math.max(0, usedPercent));
  const remaining = 100 - percentage;

  const isLow = remaining <= 15;
  const isDepleted = remaining <= 0;

  const barColor = isDepleted
    ? 'bg-red-500'
    : isLow
      ? 'bg-amber-400'
      : color === 'purple'
        ? 'bg-purple-500'
        : 'bg-blue-500';

  const trackColor = 'bg-gray-200';

  const textColor = isDepleted
    ? 'text-red-500'
    : isLow
      ? 'text-amber-600'
      : 'text-gray-500';

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 min-w-0" title={`${label}: ${percentage}% 사용`}>
        <div className={`w-12 sm:w-16 h-1.5 rounded-full ${trackColor} overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={`text-[10px] font-medium tabular-nums whitespace-nowrap ${textColor}`}>
          {percentage}%
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" title={`${label}: ${percentage}% 사용`}>
      <span className={`text-[11px] font-medium whitespace-nowrap ${textColor}`}>{label}</span>
      <div className={`w-16 sm:w-20 h-1.5 rounded-full ${trackColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`text-[11px] font-medium tabular-nums whitespace-nowrap ${textColor}`}>
        {percentage}%
      </span>
    </div>
  );
});
