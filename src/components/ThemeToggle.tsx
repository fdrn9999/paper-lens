'use client';

import { useEffect, useState } from 'react';

/**
 * Light/dark theme toggle (D-03). The initial theme is applied before paint by an
 * inline script in the root layout (reads localStorage 'paperlens-theme', falling
 * back to the OS preference), so this component just reads the current `.dark` class
 * on mount and flips it on click, persisting the choice.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('paperlens-theme', next ? 'dark' : 'light');
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  };

  return (
    <button
      onClick={toggle}
      className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border bg-surface text-gray-500 border-gray-300 hover:bg-gray-50 hover:text-gray-700 transition-colors shrink-0"
      title={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {dark ? (
        // Sun icon → switch to light
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon icon → switch to dark
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}
