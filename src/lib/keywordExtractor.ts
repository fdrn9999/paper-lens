import { PageTextContent, ExtractedKeyword, KeywordAlgorithm, KeywordContext } from './types';

// ─── Tokenization ───────────────────────────────────────────────────────────

const TOKEN_RE = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu;

/** Tokenize text into lowercase words, matching the searchEngine pattern. */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    tokens.push(m[0].toLowerCase());
  }
  return tokens;
}

// ─── Stopwords ──────────────────────────────────────────────────────────────

const EN_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'it', 'its',
  'this', 'that', 'these', 'those', 'i', 'we', 'you', 'he', 'she', 'they',
  'me', 'us', 'him', 'her', 'them', 'my', 'our', 'your', 'his', 'their',
  'mine', 'ours', 'yours', 'hers', 'theirs', 'what', 'which', 'who', 'whom',
  'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'because', 'about', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  'here', 'there', 'also', 'up', 'down', 'any', 'while', 'however',
  'et', 'al', 'fig', 'figure', 'table', 'ref', 'pp', 'vol', 'etc',
]);

const KO_STOPWORDS = new Set([
  '이', '그', '저', '것', '수', '등', '및', '또는', '그리고', '하지만',
  '때문', '위해', '대해', '통해', '의해', '에서', '으로', '에게', '까지',
  '부터', '처럼', '만큼', '보다', '에는', '에도', '에서는', '으로는',
  '하는', '되는', '있는', '없는', '같은', '다른', '모든', '각', '매',
  '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열',
  '있다', '없다', '하다', '되다', '이다', '아니다', '같다', '다르다',
]);

function isStopword(token: string): boolean {
  return EN_STOPWORDS.has(token) || KO_STOPWORDS.has(token) || token.length <= 1;
}

// ─── Shared Helpers ─────────────────────────────────────────────────────────

/** Yield control to the event loop to avoid UI blocking. */
function yieldTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Build per-page token arrays and full document tokens from PageTextContent[]. */
function buildPageTokens(pages: PageTextContent[]): {
  pageTokens: string[][];
  allTokens: string[];
} {
  const pageTokens: string[][] = [];
  const allTokens: string[] = [];
  for (const page of pages) {
    const tokens = tokenize(page.fullText);
    pageTokens.push(tokens);
    allTokens.push(...tokens);
  }
  return { pageTokens, allTokens };
}

/** Count global term frequency across all tokens. */
function countTermFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (!isStopword(t)) {
      freq.set(t, (freq.get(t) || 0) + 1);
    }
  }
  return freq;
}

/** Find pages where a term appears. */
function findTermPages(term: string, pageTokens: string[][]): number[] {
  const pages: number[] = [];
  for (let i = 0; i < pageTokens.length; i++) {
    if (pageTokens[i].some((t) => t === term)) {
      pages.push(i + 1); // 1-based page numbers
    }
  }
  return pages;
}

/** Find pages where an n-gram appears (skipping stopwords between terms). */
function findNgramPages(ngram: string[], pageTokens: string[][]): number[] {
  const pages: number[] = [];
  for (let i = 0; i < pageTokens.length; i++) {
    const filtered = pageTokens[i].filter((t) => !isStopword(t));
    for (let j = 0; j <= filtered.length - ngram.length; j++) {
      let match = true;
      for (let k = 0; k < ngram.length; k++) {
        if (filtered[j + k] !== ngram[k]) { match = false; break; }
      }
      if (match) { pages.push(i + 1); break; }
    }
  }
  return pages;
}

/** Build context snippets for a term (up to 3). */
function buildContexts(
  term: string,
  pages: PageTextContent[],
  maxContexts: number = 3,
): KeywordContext[] {
  const contexts: KeywordContext[] = [];
  const termLower = term.toLowerCase();
  for (const page of pages) {
    if (contexts.length >= maxContexts) break;
    for (const item of page.items) {
      if (contexts.length >= maxContexts) break;
      if (item.text.toLowerCase().includes(termLower)) {
        contexts.push({
          page: page.page,
          snippet: item.text.slice(0, 120),
          itemIndex: item.itemIndex,
        });
      }
    }
  }
  return contexts;
}

/** Build context snippets for an n-gram phrase (matches tokens with possible stopwords in between). */
function buildNgramContexts(
  ngramTokens: string[],
  pages: PageTextContent[],
  maxContexts: number = 3,
): KeywordContext[] {
  const contexts: KeywordContext[] = [];
  // Build a regex that allows optional stopwords/whitespace between n-gram tokens
  const pattern = ngramTokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]{0,30}');
  const re = new RegExp(pattern, 'i');
  for (const page of pages) {
    if (contexts.length >= maxContexts) break;
    for (const item of page.items) {
      if (contexts.length >= maxContexts) break;
      if (re.test(item.text)) {
        contexts.push({
          page: page.page,
          snippet: item.text.slice(0, 120),
          itemIndex: item.itemIndex,
        });
      }
    }
  }
  return contexts;
}

/** Assign a deterministic color based on index. */
function keywordColor(index: number): string {
  const hue = (index * 137.5) % 360;
  return `hsl(${hue.toFixed(1)}, 70%, 55%)`;
}

/** Normalize scores to 0-1 range. */
function normalizeScores(entries: { term: string; rawScore: number }[]): Map<string, number> {
  const max = entries.reduce((m, e) => Math.max(m, e.rawScore), 0);
  const result = new Map<string, number>();
  for (const e of entries) {
    result.set(e.term, max > 0 ? e.rawScore / max : 0);
  }
  return result;
}

// ─── TF-IDF ─────────────────────────────────────────────────────────────────

async function extractTfIdf(
  pages: PageTextContent[],
  pageTokens: string[][],
  allTokens: string[],
  topK: number,
): Promise<ExtractedKeyword[]> {
  const N = pageTokens.length;
  const totalWords = allTokens.length;

  // Document frequency: how many pages contain each term
  const df = new Map<string, number>();
  for (const tokens of pageTokens) {
    const seen = new Set<string>();
    for (const t of tokens) {
      if (!isStopword(t) && !seen.has(t)) {
        seen.add(t);
        df.set(t, (df.get(t) || 0) + 1);
      }
    }
  }

  // Global TF
  const globalTf = countTermFrequency(allTokens);

  await yieldTick();

  // TF-IDF score: log(1 + tf) * log(1 + N / df)
  // Using log(1 + N/df) instead of log(N/df) so single-page documents still produce scores
  const scored: { term: string; rawScore: number }[] = [];
  for (const [term, tf] of globalTf) {
    const docFreq = df.get(term) || 1;
    const tfidf = Math.log(1 + tf) * Math.log(1 + N / docFreq);
    scored.push({ term, rawScore: tfidf });
  }

  scored.sort((a, b) => b.rawScore - a.rawScore);
  const top = scored.slice(0, topK);
  const normalized = normalizeScores(top);

  await yieldTick();

  return top.map((entry, i) => {
    const freq = globalTf.get(entry.term) || 0;
    return {
      term: entry.term,
      score: normalized.get(entry.term) || 0,
      frequency: freq,
      frequencyPercent: totalWords > 0 ? (freq / totalWords) * 100 : 0,
      pages: findTermPages(entry.term, pageTokens),
      contexts: buildContexts(entry.term, pages),
      algorithm: 'tfidf' as KeywordAlgorithm,
      color: keywordColor(i),
    };
  });
}

// ─── TextRank ───────────────────────────────────────────────────────────────

async function extractTextRank(
  pages: PageTextContent[],
  pageTokens: string[][],
  allTokens: string[],
  topK: number,
): Promise<ExtractedKeyword[]> {
  const totalWords = allTokens.length;
  const globalTf = countTermFrequency(allTokens);

  // Filter tokens: remove stopwords, keep unique vocabulary
  const filteredTokens = allTokens.filter((t) => !isStopword(t));
  const vocab = new Set(filteredTokens);
  const vocabArr = [...vocab];
  const vocabIndex = new Map<string, number>();
  vocabArr.forEach((v, i) => vocabIndex.set(v, i));

  // Build co-occurrence graph with window size = 5
  const WINDOW = 5;
  const cooccurrence = new Map<number, Map<number, number>>();

  for (let i = 0; i < filteredTokens.length; i++) {
    const idxI = vocabIndex.get(filteredTokens[i]);
    if (idxI === undefined) continue;
    for (let j = i + 1; j < Math.min(i + WINDOW, filteredTokens.length); j++) {
      const idxJ = vocabIndex.get(filteredTokens[j]);
      if (idxJ === undefined || idxI === idxJ) continue;

      if (!cooccurrence.has(idxI)) cooccurrence.set(idxI, new Map());
      if (!cooccurrence.has(idxJ)) cooccurrence.set(idxJ, new Map());
      cooccurrence.get(idxI)!.set(idxJ, (cooccurrence.get(idxI)!.get(idxJ) || 0) + 1);
      cooccurrence.get(idxJ)!.set(idxI, (cooccurrence.get(idxJ)!.get(idxI) || 0) + 1);
    }
  }

  await yieldTick();

  // Compute weighted out-degree for each node
  const outWeight = new Float64Array(vocabArr.length);
  for (const [node, neighbors] of cooccurrence) {
    let total = 0;
    for (const w of neighbors.values()) total += w;
    outWeight[node] = total;
  }

  // PageRank iteration: damping=0.85, max 30 iterations
  const DAMPING = 0.85;
  const MAX_ITER = 30;
  const CONVERGENCE = 1e-4;
  const n = vocabArr.length;
  let scores = new Float64Array(n).fill(1 / n);

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const newScores = new Float64Array(n).fill((1 - DAMPING) / n);
    for (const [node, neighbors] of cooccurrence) {
      for (const [neighbor, weight] of neighbors) {
        if (outWeight[neighbor] > 0) {
          newScores[node] += DAMPING * (weight / outWeight[neighbor]) * scores[neighbor];
        }
      }
    }

    // Check convergence
    let diff = 0;
    for (let i = 0; i < n; i++) diff += Math.abs(newScores[i] - scores[i]);
    scores = newScores;
    if (diff < CONVERGENCE) break;

    // Yield every 10 iterations
    if (iter % 10 === 9) await yieldTick();
  }

  await yieldTick();

  // Rank and return top-K
  const scored: { term: string; rawScore: number }[] = [];
  for (let i = 0; i < vocabArr.length; i++) {
    scored.push({ term: vocabArr[i], rawScore: scores[i] });
  }
  scored.sort((a, b) => b.rawScore - a.rawScore);
  const top = scored.slice(0, topK);
  const normalized = normalizeScores(top);

  return top.map((entry, i) => {
    const freq = globalTf.get(entry.term) || 0;
    return {
      term: entry.term,
      score: normalized.get(entry.term) || 0,
      frequency: freq,
      frequencyPercent: totalWords > 0 ? (freq / totalWords) * 100 : 0,
      pages: findTermPages(entry.term, pageTokens),
      contexts: buildContexts(entry.term, pages),
      algorithm: 'textrank' as KeywordAlgorithm,
      color: keywordColor(i),
    };
  });
}

// ─── N-gram ─────────────────────────────────────────────────────────────────

async function extractNgram(
  pages: PageTextContent[],
  pageTokens: string[][],
  allTokens: string[],
  topK: number,
): Promise<ExtractedKeyword[]> {
  const totalWords = allTokens.length;
  const filteredAll = allTokens.filter((t) => !isStopword(t));

  // Count unigrams, bigrams, trigrams
  const unigramCounts = new Map<string, number>();
  const bigramCounts = new Map<string, number>();
  const trigramCounts = new Map<string, number>();

  for (const t of filteredAll) {
    unigramCounts.set(t, (unigramCounts.get(t) || 0) + 1);
  }

  for (let i = 0; i < filteredAll.length - 1; i++) {
    const key = filteredAll[i] + ' ' + filteredAll[i + 1];
    bigramCounts.set(key, (bigramCounts.get(key) || 0) + 1);
  }

  for (let i = 0; i < filteredAll.length - 2; i++) {
    const key = filteredAll[i] + ' ' + filteredAll[i + 1] + ' ' + filteredAll[i + 2];
    trigramCounts.set(key, (trigramCounts.get(key) || 0) + 1);
  }

  await yieldTick();

  // Score with length weighting: unigram 1x, bigram 1.5x, trigram 2x
  // Minimum frequency threshold: 2 for unigrams, 2 for bigrams, 1 for trigrams
  const scored: { term: string; rawScore: number; freq: number; tokens: string[] }[] = [];

  for (const [term, count] of unigramCounts) {
    if (count < 2) continue;
    scored.push({ term, rawScore: count * 1.0, freq: count, tokens: [term] });
  }
  for (const [term, count] of bigramCounts) {
    if (count < 2) continue;
    scored.push({ term, rawScore: count * 1.5, freq: count, tokens: term.split(' ') });
  }
  for (const [term, count] of trigramCounts) {
    if (count < 2) continue;
    scored.push({ term, rawScore: count * 2.0, freq: count, tokens: term.split(' ') });
  }

  scored.sort((a, b) => b.rawScore - a.rawScore);

  // Deduplicate: if a unigram is part of a higher-ranked bigram/trigram, skip it
  const selected: typeof scored = [];
  const usedTerms = new Set<string>();
  for (const entry of scored) {
    if (selected.length >= topK) break;
    // For unigrams, skip if already covered by a multi-word phrase
    if (entry.tokens.length === 1 && usedTerms.has(entry.term)) continue;
    selected.push(entry);
    for (const t of entry.tokens) usedTerms.add(t);
  }

  await yieldTick();

  const normalized = normalizeScores(selected.map((s) => ({ term: s.term, rawScore: s.rawScore })));

  return selected.map((entry, i) => ({
    term: entry.term,
    score: normalized.get(entry.term) || 0,
    frequency: entry.freq,
    frequencyPercent: totalWords > 0 ? (entry.freq / totalWords) * 100 : 0,
    pages: entry.tokens.length === 1
      ? findTermPages(entry.term, pageTokens)
      : findNgramPages(entry.tokens, pageTokens),
    contexts: entry.tokens.length === 1
      ? buildContexts(entry.term, pages)
      : buildNgramContexts(entry.tokens, pages),
    algorithm: 'ngram' as KeywordAlgorithm,
    color: keywordColor(i),
  }));
}

// ─── Public API ─────────────────────────────────────────────────────────────

const TOP_K = 20;

export type KeywordExtractionResult = {
  tfidf: ExtractedKeyword[];
  textrank: ExtractedKeyword[];
  ngram: ExtractedKeyword[];
};

/**
 * Extract keywords from PDF page contents using three algorithms.
 * Returns top 20 keywords per algorithm, with scores normalized to 0-1.
 * Uses async yields to prevent UI blocking on large documents.
 */
export async function extractKeywords(
  pages: PageTextContent[],
): Promise<KeywordExtractionResult> {
  const { pageTokens, allTokens } = buildPageTokens(pages);

  if (allTokens.length === 0) {
    return { tfidf: [], textrank: [], ngram: [] };
  }

  const [tfidf, textrank, ngram] = await Promise.all([
    extractTfIdf(pages, pageTokens, allTokens, TOP_K),
    extractTextRank(pages, pageTokens, allTokens, TOP_K),
    extractNgram(pages, pageTokens, allTokens, TOP_K),
  ]);

  return { tfidf, textrank, ngram };
}

/**
 * Extract keywords using a single algorithm.
 * Useful for on-demand re-extraction with a specific method.
 */
export async function extractKeywordsByAlgorithm(
  pages: PageTextContent[],
  algorithm: KeywordAlgorithm,
): Promise<ExtractedKeyword[]> {
  const { pageTokens, allTokens } = buildPageTokens(pages);

  if (allTokens.length === 0) return [];

  switch (algorithm) {
    case 'tfidf':
      return extractTfIdf(pages, pageTokens, allTokens, TOP_K);
    case 'textrank':
      return extractTextRank(pages, pageTokens, allTokens, TOP_K);
    case 'ngram':
      return extractNgram(pages, pageTokens, allTokens, TOP_K);
  }
}
