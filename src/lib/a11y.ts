/**
 * Given a keyboard event key on a tablist, return the index of the tab that
 * should receive focus/selection, or null if the key isn't a navigation key.
 * Wraps around and supports Home/End. Used by the sidebar and keyword-algorithm
 * tablists (A-01) so arrow-key tab navigation is announced correctly.
 */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
