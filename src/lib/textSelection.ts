// Pure, DOM-free boundary logic for mobile tap-to-select.
// Operates on a single page's extracted text items in reading (DOM) order.
// No pdfjs / React / DOM imports — unit-testable in isolation.

export interface SelItem {
  itemIndex: number; // matches the text-layer span's data-item-index
  text: string;
  y: number;         // span top (layer px), for paragraph gap detection
  height: number;    // span height (layer px)
}

export interface SelectionRange {
  startItem: number; // itemIndex of first item
  startChar: number; // inclusive char offset within startItem
  endItem: number;   // itemIndex of last item
  endChar: number;   // exclusive char offset within endItem
}

export type SelectionLevel = 'word' | 'sentence' | 'paragraph';

const WORD_CHAR = /[\p{L}\p{N}''\-]/u;
const SENT_TERMINATOR = /[.!?。！？]/;
const TRAILING_CLOSERS = /["''"』」)\]]/;

/** Array position of a given itemIndex; -1 if absent. */
export function findArrayIndex(items: SelItem[], itemIndex: number): number {
  for (let i = 0; i < items.length; i++) if (items[i].itemIndex === itemIndex) return i;
  return -1;
}

/** Expand around `offset` to the surrounding word within one item's text.
 *  Returns null when there is no word near the offset. */
export function expandToWord(text: string, offset: number): { start: number; end: number } | null {
  if (!text) return null;
  let i = Math.max(0, Math.min(offset, text.length));
  // Tap at a word's right edge: prefer the char to the left.
  if (i >= text.length || !WORD_CHAR.test(text[i])) {
    if (i > 0 && WORD_CHAR.test(text[i - 1])) i -= 1;
  }
  // Still not on a word: search right for the next one.
  if (i >= text.length || !WORD_CHAR.test(text[i])) {
    while (i < text.length && !WORD_CHAR.test(text[i])) i += 1;
    if (i >= text.length) return null;
  }
  let start = i;
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start -= 1;
  let end = i + 1;
  while (end < text.length && WORD_CHAR.test(text[end])) end += 1;
  return end > start ? { start, end } : null;
}

/** Flatten items into one space-joined string with a per-char owner map back to
 *  (array index, local char). Separator chars map to { a: -1, c: -1 }. */
function flatten(items: SelItem[]): { text: string; owner: { a: number; c: number }[] } {
  let text = '';
  const owner: { a: number; c: number }[] = [];
  for (let a = 0; a < items.length; a++) {
    if (a > 0) { text += ' '; owner.push({ a: -1, c: -1 }); }
    const t = items[a].text;
    for (let c = 0; c < t.length; c++) { text += t[c]; owner.push({ a, c }); }
  }
  return { text, owner };
}

function globalIndexOf(owner: { a: number; c: number }[], a: number, c: number): number {
  for (let g = 0; g < owner.length; g++) if (owner[g].a === a && owner[g].c === c) return g;
  return -1;
}

function isSentenceEnd(text: string, i: number): boolean {
  if (!SENT_TERMINATOR.test(text[i])) return false;
  if (text[i] === '.') {
    // decimal: 3.14
    if (/\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) return false;
    // mid-word abbreviation: e.g, U.S
    if (/[A-Za-z]/.test(text[i - 1] || '') && /[A-Za-z]/.test(text[i + 1] || '')) return false;
  }
  return true;
}

function rangeFromGlobal(
  items: SelItem[], owner: { a: number; c: number }[], gStart: number, gEnd: number,
): SelectionRange | null {
  while (gStart < gEnd && owner[gStart].a < 0) gStart += 1; // skip leading separators
  let last = gEnd - 1;
  while (last > gStart && owner[last].a < 0) last -= 1;     // skip trailing separators
  if (gStart > last) return null;
  const s = owner[gStart], e = owner[last];
  return {
    startItem: items[s.a].itemIndex, startChar: s.c,
    endItem: items[e.a].itemIndex, endChar: e.c + 1,
  };
}

/** Expand to the sentence containing the anchor (array index + local char). */
export function expandToSentence(
  items: SelItem[], anchorArray: number, anchorChar: number,
): SelectionRange | null {
  if (anchorArray < 0 || anchorArray >= items.length) return null;
  const { text, owner } = flatten(items);
  const localText = items[anchorArray].text;
  const g = globalIndexOf(owner, anchorArray, Math.max(0, Math.min(anchorChar, localText.length - 1)));
  if (g < 0) return null;

  let start = 0;
  for (let i = g - 1; i >= 0; i--) {
    if (isSentenceEnd(text, i)) { start = i + 1; break; }
  }
  while (start < text.length && /\s/.test(text[start])) start += 1;

  let end = text.length;
  for (let i = g; i < text.length; i++) {
    if (isSentenceEnd(text, i)) {
      end = i + 1;
      while (end < text.length && TRAILING_CLOSERS.test(text[end])) end += 1;
      break;
    }
  }
  return rangeFromGlobal(items, owner, start, end);
}

/** Expand to the paragraph: contiguous items with no large vertical gap. */
export function expandToParagraph(items: SelItem[], anchorArray: number): SelectionRange | null {
  if (anchorArray < 0 || anchorArray >= items.length) return null;
  const h = items[anchorArray].height || 12;
  const gap = h * 1.5;
  // Same line (dy ~ 0) or next line (dy ~ h) stays in paragraph; big jumps and
  // column breaks (large +/- dy) end it.
  const contiguous = (above: SelItem, below: SelItem) => {
    const dy = below.y - above.y;
    return dy <= gap && dy >= -gap;
  };
  let lo = anchorArray, hi = anchorArray;
  while (lo > 0 && contiguous(items[lo - 1], items[lo])) lo -= 1;
  while (hi < items.length - 1 && contiguous(items[hi], items[hi + 1])) hi += 1;
  return {
    startItem: items[lo].itemIndex, startChar: 0,
    endItem: items[hi].itemIndex, endChar: items[hi].text.length,
  };
}

/** Unified entry: expand from an anchor (itemIndex + local char) to a level. */
export function expandSelection(
  items: SelItem[], anchorItem: number, anchorChar: number, level: SelectionLevel,
): SelectionRange | null {
  const a = findArrayIndex(items, anchorItem);
  if (a < 0) return null;
  if (level === 'word') {
    const w = expandToWord(items[a].text, anchorChar);
    return w ? { startItem: anchorItem, startChar: w.start, endItem: anchorItem, endChar: w.end } : null;
  }
  if (level === 'sentence') return expandToSentence(items, a, anchorChar);
  return expandToParagraph(items, a);
}

/** Next level up, capped at paragraph. */
export function nextLevel(level: SelectionLevel): SelectionLevel {
  return level === 'word' ? 'sentence' : 'paragraph';
}

function cleanSelText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/^\s+|\s+$/g, '');
}

/** Assemble the human-readable selected text for a range. */
export function buildSelectionText(items: SelItem[], range: SelectionRange): string {
  const aStart = findArrayIndex(items, range.startItem);
  const aEnd = findArrayIndex(items, range.endItem);
  if (aStart < 0 || aEnd < 0 || aEnd < aStart) return '';
  let out = '';
  for (let k = aStart; k <= aEnd; k++) {
    const t = items[k].text;
    const s = k === aStart ? range.startChar : 0;
    const e = k === aEnd ? range.endChar : t.length;
    out += (k > aStart ? ' ' : '') + t.slice(s, e);
  }
  return cleanSelText(out);
}
