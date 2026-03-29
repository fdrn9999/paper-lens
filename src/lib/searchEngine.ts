import { PageTextContent, SearchResult, ExtractedTextItem, HighlightSpan } from './types';

interface TokenWithPosition {
  token: string;
  start: number;
  end: number;
}

interface ItemOffset {
  item: ExtractedTextItem;
  /** Start position of this item's text in the concatenated page text */
  start: number;
  /** End position (exclusive) */
  end: number;
}

/**
 * Tokenize text into words with their character positions.
 */
function tokenize(text: string): TokenWithPosition[] {
  const tokens: TokenWithPosition[] = [];
  const regex = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      token: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

function containsCJK(text: string): boolean {
  return /[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/.test(text);
}

/** Returns true if query contains special chars that the tokenizer would strip (C++, C#, O(N)). */
function containsSpecialChars(text: string): boolean {
  return /[+#(){}[\]@$%^&*=<>~`|\\]/.test(text);
}

/**
 * Substring search for queries with special characters (C++, C#, O(N) etc.)
 * that the word tokenizer would strip.
 */
function specialCharSearch(
  pageContents: PageTextContent[],
  keyword: string,
  caseSensitive: boolean
): SearchResult[] {
  const results: SearchResult[] = [];
  const compareKw = caseSensitive ? keyword : keyword.toLowerCase();

  for (const page of pageContents) {
    if (page.items.length === 0) continue;
    const { text: concat, offsets } = buildConcatText(page.items, ' ');
    const haystack = caseSensitive ? concat : concat.toLowerCase();

    let pos = 0;
    while ((pos = haystack.indexOf(compareKw, pos)) !== -1) {
      const matchEnd = pos + keyword.length;
      const hit = findItemAt(offsets, pos);
      if (hit) {
        const localStart = Math.max(0, pos - hit.start);
        const localEnd = Math.min(hit.item.text.length, matchEnd - hit.start);
        const spans = findSpannedItems(offsets, pos, matchEnd);
        results.push({
          id: `${page.page}-${hit.item.itemIndex}-${pos}`,
          page: page.page,
          matchedToken: concat.slice(pos, matchEnd),
          context: hit.item.text,
          itemIndex: hit.item.itemIndex,
          charStart: localStart,
          charEnd: localEnd,
          spans: spans.length > 1 ? spans : undefined,
        });
      }
      pos += 1;
    }
  }
  return results;
}

/**
 * Build a concatenated text from all items and track each item's character range.
 * @param separator '' for CJK (characters may be contiguous across items),
 *                  ' ' for Latin (words are space-separated)
 */
function buildConcatText(
  items: ExtractedTextItem[],
  separator: string
): { text: string; offsets: ItemOffset[] } {
  const offsets: ItemOffset[] = [];
  const parts: string[] = [];
  let pos = 0;
  for (let i = 0; i < items.length; i++) {
    if (i > 0) pos += separator.length;
    offsets.push({ item: items[i], start: pos, end: pos + items[i].text.length });
    parts.push(items[i].text);
    pos += items[i].text.length;
  }
  return { text: parts.join(separator), offsets };
}

/**
 * Find the ItemOffset whose range contains charPos.
 * If charPos falls on a separator, returns the next item.
 */
function findItemAt(offsets: ItemOffset[], charPos: number): ItemOffset | undefined {
  for (const o of offsets) {
    if (charPos >= o.start && charPos < o.end) return o;
  }
  // charPos is on a separator — return the next item after the gap
  for (const o of offsets) {
    if (o.start > charPos) return o;
  }
  return offsets[offsets.length - 1];
}

/**
 * Find all items that a match range [matchStart, matchEnd) spans,
 * returning per-item local charStart/charEnd for highlight rendering.
 */
function findSpannedItems(offsets: ItemOffset[], matchStart: number, matchEnd: number): HighlightSpan[] {
  const spans: HighlightSpan[] = [];
  for (const o of offsets) {
    if (o.end <= matchStart) continue;
    if (o.start >= matchEnd) break;
    spans.push({
      itemIndex: o.item.itemIndex,
      charStart: Math.max(0, matchStart - o.start),
      charEnd: Math.min(o.item.text.length, matchEnd - o.start),
    });
  }
  return spans;
}

/** Regex matching characters to KEEP (letters, numbers, CJK). Everything else is stripped. */
const KEEP_CHARS = /[\p{L}\p{N}]/u;

/**
 * Build a mapping from a stripped string back to positions in the original.
 * Strips whitespace, punctuation, brackets — keeps only letters/numbers/CJK.
 * This handles mixed queries like "인공지능 (AI)" → "인공지능AI".
 */
function buildStrippedMapping(text: string): { stripped: string; toOriginal: number[] } {
  const toOriginal: number[] = [];
  let stripped = '';
  for (let i = 0; i < text.length; i++) {
    if (KEEP_CHARS.test(text[i])) {
      toOriginal.push(i);
      stripped += text[i];
    }
  }
  return { stripped, toOriginal };
}

/**
 * CJK substring search.
 * Both query AND haystack are stripped of whitespace so that
 * "인공 지능" in the PDF matches query "인공지능" (and vice versa).
 * An offset mapping reverses positions back to the original text for accurate highlighting.
 */
function cjkSearch(
  pageContents: PageTextContent[],
  keyword: string,
  caseSensitive: boolean
): SearchResult[] {
  const results: SearchResult[] = [];
  // Strip all non-letter/non-number chars so "인공지능 (AI)" → "인공지능AI"
  const normalizedKw = keyword.replace(/[^\p{L}\p{N}]/gu, '');
  if (normalizedKw.length === 0) return [];
  const compareKw = caseSensitive ? normalizedKw : normalizedKw.toLowerCase();

  for (const page of pageContents) {
    if (page.items.length === 0) continue;
    const { text: concat, offsets } = buildConcatText(page.items, '');
    // Strip whitespace from haystack too, with mapping back to original positions
    const rawHaystack = caseSensitive ? concat : concat.toLowerCase();
    const { stripped: haystack, toOriginal } = buildStrippedMapping(rawHaystack);

    let pos = 0;
    while ((pos = haystack.indexOf(compareKw, pos)) !== -1) {
      // Map stripped positions back to original concat positions
      const origStart = toOriginal[pos];
      const origEnd = toOriginal[pos + normalizedKw.length - 1] + 1;
      const hit = findItemAt(offsets, origStart);
      if (hit) {
        const localStart = Math.max(0, origStart - hit.start);
        const localEnd = Math.min(hit.item.text.length, origEnd - hit.start);
        const spans = findSpannedItems(offsets, origStart, origEnd);
        results.push({
          id: `${page.page}-${hit.item.itemIndex}-${origStart}`,
          page: page.page,
          matchedToken: concat.slice(origStart, origEnd),
          context: hit.item.text,
          itemIndex: hit.item.itemIndex,
          charStart: localStart,
          charEnd: localEnd,
          spans: spans.length > 1 ? spans : undefined,
        });
      }
      pos += 1;
    }
  }
  return results;
}

/**
 * Token-based exact search.
 * Items are joined WITH spaces so that "Artificial" + "Intelligence" is searchable
 * as the phrase "Artificial Intelligence".
 *
 * - Latin/numbers: exact token equality ("ai" matches "AI" but NOT "claim")
 * - CJK (Korean/Chinese/Japanese): substring matching ("인공지능" matches "인공지능은")
 */
export function exactSearch(
  pageContents: PageTextContent[],
  keyword: string,
  caseSensitive: boolean = false
): SearchResult[] {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  if (containsCJK(trimmed)) {
    return cjkSearch(pageContents, trimmed, caseSensitive);
  }

  // Fall back to substring search for queries with special characters (C++, C#, O(N))
  if (containsSpecialChars(trimmed)) {
    return specialCharSearch(pageContents, trimmed, caseSensitive);
  }

  const results: SearchResult[] = [];
  const compareKw = caseSensitive ? trimmed : trimmed.toLowerCase();
  // Tokenize the query the same way as the text — strips punctuation so "learning," becomes "learning"
  const kwTokens = tokenize(compareKw).map((t) => t.token);
  if (kwTokens.length === 0) return [];

  for (const page of pageContents) {
    if (page.items.length === 0) continue;
    const { text: concat, offsets } = buildConcatText(page.items, ' ');
    const tokens = tokenize(concat);

    if (kwTokens.length === 1) {
      // Single-word: exact token match
      for (const t of tokens) {
        const ct = caseSensitive ? t.token : t.token.toLowerCase();
        if (ct === compareKw) {
          const hit = findItemAt(offsets, t.start);
          if (hit) {
            const localStart = Math.max(0, t.start - hit.start);
            const localEnd = Math.min(hit.item.text.length, t.end - hit.start);
            results.push({
              id: `${page.page}-${hit.item.itemIndex}-${t.start}`,
              page: page.page,
              matchedToken: t.token,
              context: hit.item.text,
              itemIndex: hit.item.itemIndex,
              charStart: localStart,
              charEnd: localEnd,
            });
          }
        }
      }
    } else {
      // Multi-word: consecutive token match
      for (let i = 0; i <= tokens.length - kwTokens.length; i++) {
        let allMatch = true;
        for (let j = 0; j < kwTokens.length; j++) {
          const ct = caseSensitive ? tokens[i + j].token : tokens[i + j].token.toLowerCase();
          if (ct !== kwTokens[j]) { allMatch = false; break; }
        }
        if (allMatch) {
          const first = tokens[i];
          const last = tokens[i + kwTokens.length - 1];
          const matched = concat.slice(first.start, last.end);
          const hit = findItemAt(offsets, first.start);
          if (hit) {
            const localStart = Math.max(0, first.start - hit.start);
            const localEnd = Math.min(hit.item.text.length, last.end - hit.start);
            const spans = findSpannedItems(offsets, first.start, last.end);
            results.push({
              id: `${page.page}-${hit.item.itemIndex}-${first.start}`,
              page: page.page,
              matchedToken: matched,
              context: hit.item.text,
              itemIndex: hit.item.itemIndex,
              charStart: localStart,
              charEnd: localEnd,
              spans: spans.length > 1 ? spans : undefined,
            });
          }
        }
      }
    }
  }

  // Fallback: if token-based search found nothing, try space-stripped substring search
  // to catch PDF.js kerning splits like "Arti ficial" → "Artificial"
  if (results.length === 0 && kwTokens.length === 1) {
    for (const page of pageContents) {
      if (page.items.length === 0) continue;
      const { text: concat, offsets } = buildConcatText(page.items, ' ');
      const rawHaystack = caseSensitive ? concat : concat.toLowerCase();
      const { stripped: haystack, toOriginal } = buildStrippedMapping(rawHaystack);

      let pos = 0;
      while ((pos = haystack.indexOf(compareKw, pos)) !== -1) {
        const origStart = toOriginal[pos];
        const origEnd = toOriginal[pos + compareKw.length - 1] + 1;
        const hit = findItemAt(offsets, origStart);
        if (hit) {
          const localStart = Math.max(0, origStart - hit.start);
          const localEnd = Math.min(hit.item.text.length, origEnd - hit.start);
          const spans = findSpannedItems(offsets, origStart, origEnd);
          results.push({
            id: `${page.page}-${hit.item.itemIndex}-${origStart}`,
            page: page.page,
            matchedToken: concat.slice(origStart, origEnd),
            context: hit.item.text,
            itemIndex: hit.item.itemIndex,
            charStart: localStart,
            charEnd: localEnd,
            spans: spans.length > 1 ? spans : undefined,
          });
        }
        pos += 1;
      }
    }
  }

  return results;
}
