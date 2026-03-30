export interface ExtractedTextItem {
  text: string;
  page: number;
  itemIndex: number;
  transform: number[];
  width: number;
  height: number;
}

export interface PageTextContent {
  page: number;
  items: ExtractedTextItem[];
  fullText: string;
}

export interface HighlightSpan {
  itemIndex: number;
  charStart: number;
  charEnd: number;
}

export interface SearchResult {
  id: string;
  page: number;
  matchedToken: string;
  context: string;
  itemIndex: number;
  charStart: number;
  charEnd: number;
  /** Present when a match spans multiple text items */
  spans?: HighlightSpan[];
  /** Color for this search term's highlights (multi-term search) */
  termColor?: string;
  /** Label identifying which search term matched */
  termLabel?: string;
}

/**
 * Translation error codes (used when isTranslationError === true).
 * Actual translation text remains a plain string in translationResult.
 */
export type TranslationErrorCode =
  | 'TRANSLATE_QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'API_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'ALREADY_KOREAN';

export interface SearchTerm {
  id: string;
  term: string;
  color: string;
}

export type KeywordAlgorithm = 'tfidf' | 'textrank' | 'ngram';

export interface KeywordContext {
  page: number;
  snippet: string;
  itemIndex: number;
}

export interface ExtractedKeyword {
  term: string;
  score: number;
  frequency: number;
  frequencyPercent: number;
  pages: number[];
  contexts: KeywordContext[];
  algorithm: KeywordAlgorithm;
  color: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
