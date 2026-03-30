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
  /** True for semantic search results (affects rendering style) */
  semantic?: boolean;
  /** Relevance score 0-1 for semantic results */
  relevanceScore?: number;
  /** Color for this search term's highlights (multi-term search) */
  termColor?: string;
  /** Label identifying which search term matched */
  termLabel?: string;
}

/**
 * Structured embedding progress status.
 * Store emits these codes; UI components resolve them to display text via getEmbeddingMessage().
 */
export interface EmbeddingProgress {
  code:
    | 'WAIT_EXTRACTION'
    | 'EMBED_QUOTA_EXCEEDED'
    | 'RATE_LIMITED'
    | 'ANALYZING'
    | 'COMPARING_KEYWORD'
    | 'NO_RESULTS'
    | 'FALLBACK_RESULTS'
    | 'TIMEOUT'
    | 'NETWORK_ERROR'
    | 'API_ERROR'
    | 'EMBED_FAILED';
  /** Batch progress (for ANALYZING) */
  current?: number;
  total?: number;
  /** Server error detail */
  detail?: string;
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
