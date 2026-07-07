import type { StateStorage } from 'zustand/middleware';

/**
 * localStorage wrapper that never throws. Writes can fail in Safari private mode,
 * when the quota is exceeded, or when storage is blocked; unhandled, those errors
 * would crash a Zustand `set()` mid-update. Reads/removes fail silently; a failed
 * write surfaces a one-time toast so the user knows their preferences won't persist.
 */

let warnedQuota = false;

function toast(text: string, type: 'error' | 'info' = 'error') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paperlens-toast', { detail: { text, type } }));
  }
}

export const safeLocalStorage: StateStorage = {
  getItem(name: string): string | null {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(name) : null;
    } catch {
      return null;
    }
  },
  setItem(name: string, value: string): void {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(name, value);
    } catch {
      if (!warnedQuota) {
        warnedQuota = true;
        toast('브라우저 저장 공간이 부족해 설정이 저장되지 않을 수 있습니다.');
      }
    }
  },
  removeItem(name: string): void {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

/** Read a raw localStorage value, returning null on any failure. */
export function safeLocalGet(key: string): string | null {
  return safeLocalStorage.getItem(key) as string | null;
}

/** Write a raw localStorage value, swallowing any failure. */
export function safeLocalSet(key: string, value: string): void {
  safeLocalStorage.setItem(key, value);
}
