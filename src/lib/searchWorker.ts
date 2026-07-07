/// <reference lib="webworker" />
// Web Worker entry: runs the (pure, DOM-free) tiered search off the main thread so
// large/fuzzy searches don't freeze the UI. Falls back to the main thread in
// searchRunner.ts if this worker can't be constructed or doesn't respond.

import { searchAllTerms, type SearchTermSpec } from './searchEngine';
import type { PageTextContent, SearchResult } from './types';

export interface SearchWorkerRequest {
  id: number;
  pages: PageTextContent[];
  terms: SearchTermSpec[];
  caseSensitive: boolean;
}

export interface SearchWorkerResponse {
  id: number;
  results: SearchResult[];
}

self.addEventListener('message', (e: MessageEvent<SearchWorkerRequest>) => {
  const { id, pages, terms, caseSensitive } = e.data;
  const results = searchAllTerms(pages, terms, caseSensitive);
  const response: SearchWorkerResponse = { id, results };
  (self as unknown as Worker).postMessage(response);
});
