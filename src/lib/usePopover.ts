import { useEffect, useRef } from 'react';

/**
 * Accessibility plumbing shared by the header popovers (Help / Usage). Adds what
 * both were missing (A-03): a focus trap inside the panel, focus moved into the
 * panel on open, focus returned to the trigger on Escape/close, plus the existing
 * click-outside + Escape behavior. Attach `triggerRef` to the toggle button and
 * `panelRef` to the popover panel.
 */
export function usePopover(isOpen: boolean, onClose: () => void) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;

    const focusables = (): HTMLElement[] => {
      if (!panel) return [];
      return Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
    };

    // Move focus into the panel on open.
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        triggerRef.current?.focus();
        return;
      }
      if (e.key === 'Tab') {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panel && !panel.contains(target) && !triggerRef.current?.contains(target)) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [isOpen, onClose]);

  return { triggerRef, panelRef };
}
