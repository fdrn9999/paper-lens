/** Default highlight color for a search match with no assigned term color. */
export const DEFAULT_SEARCH_HIGHLIGHT = '#FFD500';

/**
 * Color palette for multi-term search highlighting.
 * Index 0 is DEFAULT_SEARCH_HIGHLIGHT so a single-term search matches the default.
 */
export const SEARCH_TERM_COLORS = [
  DEFAULT_SEARCH_HIGHLIGHT, '#FF6B6B', '#4ECDC4', '#A78BFA', '#FB923C',
  '#34D399', '#60A5FA', '#F472B6', '#FBBF24', '#818CF8',
];
