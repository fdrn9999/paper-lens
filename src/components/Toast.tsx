'use client';

import { useEffect, useState } from 'react';

interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;

export function showToast(text: string, type: 'success' | 'error' | 'info' = 'info') {
  window.dispatchEvent(new CustomEvent('paperlens-toast', { detail: { text, type } }));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { text, type } = (e as CustomEvent).detail;
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, text, type }]);
      const duration = type === 'error' ? 6000 : 3500;
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
    };
    window.addEventListener('paperlens-toast', handler);
    return () => window.removeEventListener('paperlens-toast', handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[200] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white flex items-center
            max-sm:animate-slide-up sm:animate-slide-in
            ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'success' ? 'bg-green-600' : 'bg-gray-800'}`}
        >
          <span className="flex-1">{toast.text}</span>
          <button
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            className="ml-2 shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
            aria-label="닫기"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
