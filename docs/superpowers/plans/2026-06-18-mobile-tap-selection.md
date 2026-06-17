# Mobile Tap-to-Select for Translation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On touch devices, let the user tap a word to select it (auto-showing a `[번역] [확장]` row), expand the selection word → sentence → paragraph, and drag to fine-tune — all via a custom overlay, with no native browser selection or OS toolbar.

**Architecture:** A pure, DOM-free module (`src/lib/textSelection.ts`) computes word/sentence/paragraph boundaries over a page's extracted text items. `PDFViewer.tsx` adds touch gesture detection, hit-tests the tap point to a text-layer span via `caretRangeFromPoint`, renders the selection with the existing highlight-rect primitives into a new `.pdf-selection-layer`, and writes the result straight into `selectedText`. Desktop mouse selection is untouched; native selection is disabled only on coarse pointers.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, Zustand store, pdf.js text layer, plain DOM. Unit tests use Node 24's built-in `node:test` with native TS type-stripping (zero new dependencies).

**Spec:** `docs/superpowers/specs/2026-06-18-mobile-tap-selection-design.md`

**Testing note:** This repo has no test runner and the prior plan used manual renderer verification. The *pure* boundary logic (Task 1) is genuinely unit-tested with `node --test` (no new deps). The DOM/touch/React integration (Tasks 2–8) is verified in the real renderer (Task 9), matching the repo convention and the spec's verification-grounding requirement.

---

## File Structure

- **Create** `src/lib/textSelection.ts` — pure boundary logic (word/sentence/paragraph), text builder. No DOM/React/pdfjs imports.
- **Create** `src/lib/textSelection.test.ts` — `node:test` unit tests for the pure module.
- **Modify** `tsconfig.json` — exclude `*.test.ts` from typechecking (test imports use `.ts` specifiers).
- **Modify** `package.json` — add a `test` script.
- **Modify** `src/app/globals.css` — `.pdf-selection-layer` / `.pdf-selection-mark` styles + coarse-pointer native-selection disable.
- **Modify** `src/components/PDFViewer.tsx` — module-scope DOM helpers, selection overlay rendering, selection action callbacks, touch gesture effect, floating-row `확장` button, dismiss/clear integration, hint copy.

---

## Task 1: Pure boundary-logic module + unit tests

**Files:**
- Create: `src/lib/textSelection.ts`
- Test: `src/lib/textSelection.test.ts`
- Modify: `tsconfig.json:22`
- Modify: `package.json:9`

- [ ] **Step 1: Write the failing test**

Create `src/lib/textSelection.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expandToWord, expandSelection, buildSelectionText, nextLevel, findArrayIndex,
  type SelItem,
} from './textSelection.ts';

const items: SelItem[] = [
  { itemIndex: 0, text: 'The cat sat.', y: 0, height: 10 },
  { itemIndex: 1, text: 'Then it ran', y: 12, height: 10 },
  { itemIndex: 2, text: 'away fast.', y: 24, height: 10 },
  { itemIndex: 3, text: 'New para here.', y: 60, height: 10 }, // big gap -> new paragraph
];

test('expandToWord selects the word under the offset', () => {
  assert.deepEqual(expandToWord('hello world', 2), { start: 0, end: 5 });
  assert.deepEqual(expandToWord('hello world', 8), { start: 6, end: 11 });
});

test('expandToWord at a space picks the adjacent word', () => {
  assert.deepEqual(expandToWord('hello world', 5), { start: 0, end: 5 });
});

test('expandToWord returns null when no word is present', () => {
  assert.equal(expandToWord('   ', 1), null);
  assert.equal(expandToWord('', 0), null);
});

test('word level stays within one item', () => {
  assert.deepEqual(expandSelection(items, 0, 5, 'word'),
    { startItem: 0, startChar: 4, endItem: 0, endChar: 7 });
});

test('sentence level spans items up to the terminator', () => {
  const r = expandSelection(items, 1, 2, 'sentence');
  assert.deepEqual(r, { startItem: 1, startChar: 0, endItem: 2, endChar: 10 });
  assert.equal(buildSelectionText(items, r!), 'Then it ran away fast.');
});

test('sentence stops at a terminator inside an item', () => {
  const r = expandSelection(items, 0, 1, 'sentence');
  assert.equal(buildSelectionText(items, r!), 'The cat sat.');
});

test('paragraph stops at a large vertical gap', () => {
  const r = expandSelection(items, 1, 2, 'paragraph');
  assert.equal(r!.startItem, 0);
  assert.equal(r!.endItem, 2);
  assert.equal(buildSelectionText(items, r!), 'The cat sat. Then it ran away fast.');
});

test('decimal numbers are not sentence boundaries', () => {
  const dec: SelItem[] = [{ itemIndex: 0, text: 'Pi is 3.14 today.', y: 0, height: 10 }];
  const r = expandSelection(dec, 0, 0, 'sentence');
  assert.equal(buildSelectionText(dec, r!), 'Pi is 3.14 today.');
});

test('nextLevel caps at paragraph', () => {
  assert.equal(nextLevel('word'), 'sentence');
  assert.equal(nextLevel('sentence'), 'paragraph');
  assert.equal(nextLevel('paragraph'), 'paragraph');
});

test('findArrayIndex maps itemIndex to array position', () => {
  assert.equal(findArrayIndex(items, 2), 2);
  assert.equal(findArrayIndex(items, 99), -1);
});
```

- [ ] **Step 2: Wire tooling so the test can run and the app still typechecks**

Edit `tsconfig.json:22` — exclude test files (their `.ts` import specifiers must not be typechecked by Next):

```json
  "exclude": ["node_modules", "**/*.test.ts"]
```

Edit `package.json` — add a `test` script inside `"scripts"` (after `"lint": "next lint"`, line 9; add a comma to the lint line):

```json
        "lint": "next lint",
        "test": "node --test src/lib/textSelection.test.ts"
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './textSelection.ts'` (module not created yet).

- [ ] **Step 4: Write the implementation**

Create `src/lib/textSelection.ts`:

```ts
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

const WORD_CHAR = /[\p{L}\p{N}'’\-]/u;
const SENT_TERMINATOR = /[.!?。！？]/;
const TRAILING_CLOSERS = /["'’”』」)\]]/;

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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all 10 tests pass (`# pass 10`, `# fail 0`).

- [ ] **Step 6: Verify the app still typechecks/builds**

Run: `npm run lint`
Expected: PASS (no errors about `.ts` import extensions — test files are excluded).

- [ ] **Step 7: Commit**

```bash
git add src/lib/textSelection.ts src/lib/textSelection.test.ts tsconfig.json package.json
git commit -m "feat(mobile): pure word/sentence/paragraph boundary logic for tap-select

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Selection-layer CSS + disable native selection on touch

**Files:**
- Modify: `src/app/globals.css` (after `.highlight-mark.current` block, ~line 139)

- [ ] **Step 1: Add the selection layer/mark styles and coarse-pointer rule**

Insert after the `.highlight-mark.current { ... }` block (~line 139) in `src/app/globals.css`:

```css
/* Custom tap-selection overlay (mobile) */
.pdf-selection-layer {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1; /* above canvas, below the text layer (z-index 2) */
}

.pdf-selection-mark {
  position: absolute;
  background: rgba(0, 100, 200, 0.3);
  border-radius: 1px;
}

/* On touch devices, suppress native selection so our custom engine drives it
   (no OS selection toolbar / handles). Desktop mouse selection is unaffected. */
@media (pointer: coarse) {
  .textLayer {
    -webkit-user-select: none;
    user-select: none;
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run dev` (then stop it with Ctrl-C once it reports "Ready").
Expected: dev server starts with no CSS errors. (Visual effect is verified in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(mobile): selection-overlay styles; disable native select on touch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Module-scope DOM helpers in PDFViewer

**Files:**
- Modify: `src/components/PDFViewer.tsx` (top of file: imports ~line 1–9; new helpers after the `FLOATING_BTN_ABOVE_THRESHOLD` const at line 12)

- [ ] **Step 1: Import the pure module**

After line 7 (`import type { PdfjsDocument, PdfjsViewport, PdfjsTextItem } from '@/lib/pdfLoader';`) add:

```ts
import {
  expandSelection, buildSelectionText, nextLevel,
  type SelItem, type SelectionRange, type SelectionLevel,
} from '@/lib/textSelection';
```

- [ ] **Step 2: Add module-scope DOM helpers**

After the `FLOATING_BTN_ABOVE_THRESHOLD` const (line 12), before `export default memo(...)` (line 14), add:

```ts
/** Read a rendered text layer's spans into SelItem[] (DOM order = reading order). */
function buildSelItems(textLayer: HTMLElement): SelItem[] {
  const spans = textLayer.querySelectorAll('span[data-item-index]');
  const items: SelItem[] = [];
  spans.forEach((el) => {
    const span = el as HTMLElement;
    items.push({
      itemIndex: Number(span.dataset.itemIndex),
      text: span.textContent || '',
      y: parseFloat(span.style.top) || 0,
      height: parseFloat(span.style.height) || 12,
    });
  });
  return items;
}

/** Estimate a char offset within a span from a client x-coordinate (fallback only). */
function estimateCharByX(span: HTMLElement, clientX: number): number {
  const text = span.textContent || '';
  if (!text) return 0;
  const rect = span.getBoundingClientRect();
  const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  return Math.max(0, Math.min(text.length - 1, Math.round(ratio * text.length)));
}

/** Resolve a viewport point to a text-layer span + char offset. */
function resolveTouchPoint(
  x: number, y: number,
): { textLayer: HTMLElement; itemIndex: number; localChar: number } | null {
  type CaretDoc = Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  const doc = document as CaretDoc;
  let node: Node | null = null;
  let offset = 0;
  let haveCaret = false;
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    if (r) { node = r.startContainer; offset = r.startOffset; haveCaret = true; }
  } else if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    if (p) { node = p.offsetNode; offset = p.offset; haveCaret = true; }
  }

  const baseEl: HTMLElement | null = node
    ? (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement))
    : (document.elementFromPoint(x, y) as HTMLElement | null);
  const span = baseEl?.closest('span[data-item-index]') as HTMLElement | null;
  const textLayer = span?.closest('.textLayer') as HTMLElement | null;
  if (!span || !textLayer) return null;

  // Use the caret offset only when it actually points inside this span's text node.
  const caretInSpan =
    haveCaret && node?.nodeType === Node.TEXT_NODE && node.parentElement === span;
  const localChar = caretInSpan ? offset : estimateCharByX(span, x);
  return { textLayer, itemIndex: Number(span.dataset.itemIndex), localChar };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run lint`
Expected: PASS. (Unused-import warnings for the not-yet-used pure helpers are acceptable at this step; they are wired up in Tasks 4–6.)

- [ ] **Step 4: Commit**

```bash
git add src/components/PDFViewer.tsx
git commit -m "feat(mobile): DOM hit-testing helpers for tap-select

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Selection overlay rendering + state

**Files:**
- Modify: `src/components/PDFViewer.tsx` (state near line 51; new in-component helpers near the highlight helpers ~line 624–637)

- [ ] **Step 1: Add selection state and ref**

After line 52 (`const scrollStartRef = useRef<number | null>(null);`) add:

```ts
  const [selLevel, setSelLevel] = useState<SelectionLevel | null>(null);
  const selectionRef = useRef<{
    wrapper: HTMLElement;
    textLayer: HTMLElement;
    range: SelectionRange;
    anchorItem: number;
    anchorChar: number;
    level: SelectionLevel;
    fromTap: boolean;
  } | null>(null);
```

- [ ] **Step 2: Add the selection-overlay helpers**

Immediately after the `createHighlightMark` function (ends at line 637, before `findTokenInSpanText` at line 639) add:

```ts
  /** Get or create the per-wrapper selection overlay layer. */
  function ensureSelectionLayer(wrapper: HTMLElement): HTMLElement {
    let layer = wrapper.querySelector('.pdf-selection-layer') as HTMLElement | null;
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'pdf-selection-layer';
      wrapper.appendChild(layer);
    }
    return layer;
  }

  /** Draw one selection rect on a span (reuses computeHighlightRect). */
  function createSelectionMark(
    span: HTMLElement, wrapper: HTMLElement, charStart: number, charEnd: number, layer: HTMLElement,
  ) {
    const r = computeHighlightRect(span, wrapper, charStart, charEnd);
    const div = document.createElement('div');
    div.className = 'pdf-selection-mark';
    div.style.cssText = `left:${r.left}px;top:${r.top}px;width:${Math.max(r.width, 2)}px;height:${r.height}px;`;
    layer.appendChild(div);
  }

  /** Remove all selection marks across every rendered page. */
  const clearSelectionOverlay = useCallback(() => {
    document.querySelectorAll('.pdf-selection-layer').forEach((l) => {
      while (l.firstChild) l.removeChild(l.firstChild);
    });
  }, []);

  /** Render a selection range into the wrapper's overlay. */
  const renderSelectionRange = useCallback((
    wrapper: HTMLElement, textLayer: HTMLElement, range: SelectionRange,
  ) => {
    const layer = ensureSelectionLayer(wrapper);
    while (layer.firstChild) layer.removeChild(layer.firstChild);
    const spans = textLayer.querySelectorAll('span[data-item-index]');
    spans.forEach((el) => {
      const span = el as HTMLElement;
      const idx = Number(span.dataset.itemIndex);
      if (idx < range.startItem || idx > range.endItem) return;
      const text = span.textContent || '';
      const cs = idx === range.startItem ? range.startChar : 0;
      const ce = idx === range.endItem ? range.endChar : text.length;
      if (ce > cs) createSelectionMark(span, wrapper, cs, ce, layer);
    });
  }, []);

  /** Position the floating [번역][확장] row above (or below) the current selection. */
  const positionRowForSelection = useCallback((wrapper: HTMLElement) => {
    const layer = wrapper.querySelector('.pdf-selection-layer') as HTMLElement | null;
    const marks = layer ? (Array.from(layer.children) as HTMLElement[]) : [];
    if (marks.length === 0) { setFloatingBtn(null); return; }
    let top = Infinity, bottom = -Infinity, left = Infinity;
    for (const m of marks) {
      const rc = m.getBoundingClientRect();
      top = Math.min(top, rc.top);
      bottom = Math.max(bottom, rc.bottom);
      left = Math.min(left, rc.left);
    }
    const x = Math.min(Math.max(left, 10), window.innerWidth - 120);
    const useAbove = top > FLOATING_BTN_ABOVE_THRESHOLD;
    const y = useAbove ? top - 8 : bottom + 8;
    setFloatingBtn({ x, y, useAbove });
    const scrollContainer = viewerMode === 'scroll'
      ? scrollContainerRef.current
      : canvasContainerRef.current?.parentElement;
    if (scrollContainer) scrollStartRef.current = scrollContainer.scrollTop;
  }, [viewerMode]);
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run lint`
Expected: PASS (some new helpers still unused until Task 5 — acceptable).

- [ ] **Step 4: Commit**

```bash
git add src/components/PDFViewer.tsx
git commit -m "feat(mobile): custom selection overlay rendering + positioning

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Selection action callbacks

**Files:**
- Modify: `src/components/PDFViewer.tsx` (after `positionRowForSelection`, added in Task 4; and `handleTranslateClick` at lines 65–73)

- [ ] **Step 1: Add the select / drag-extend / dismiss / expand callbacks**

Immediately after `positionRowForSelection` (from Task 4) add:

```ts
  type TapAnchor = { itemIndex: number; localChar: number; textLayer: HTMLElement; wrapper: HTMLElement };

  /** Tap/expand: select word|sentence|paragraph around the anchor. */
  const selectAtAnchor = useCallback((anchor: TapAnchor, level: SelectionLevel) => {
    const items = buildSelItems(anchor.textLayer);
    const range = expandSelection(items, anchor.itemIndex, anchor.localChar, level);
    if (!range) { return; }
    renderSelectionRange(anchor.wrapper, anchor.textLayer, range);
    setSelectedText(buildSelectionText(items, range));
    selectionRef.current = {
      wrapper: anchor.wrapper, textLayer: anchor.textLayer, range,
      anchorItem: anchor.itemIndex, anchorChar: anchor.localChar, level, fromTap: true,
    };
    setSelLevel(level);
    positionRowForSelection(anchor.wrapper);
    dismissDragHint();
  }, [renderSelectionRange, positionRowForSelection, setSelectedText, dismissDragHint]);

  /** Drag-extend: select from anchor word to the word currently under the finger. */
  const applyDragSelection = useCallback((
    anchor: TapAnchor, cur: { itemIndex: number; localChar: number },
  ) => {
    const items = buildSelItems(anchor.textLayer);
    const a = { item: anchor.itemIndex, char: anchor.localChar };
    const b = { item: cur.itemIndex, char: cur.localChar };
    const forward = a.item < b.item || (a.item === b.item && a.char <= b.char);
    const [s, e] = forward ? [a, b] : [b, a];
    const range: SelectionRange = { startItem: s.item, startChar: s.char, endItem: e.item, endChar: e.char + 1 };
    renderSelectionRange(anchor.wrapper, anchor.textLayer, range);
    setSelectedText(buildSelectionText(items, range));
    selectionRef.current = {
      wrapper: anchor.wrapper, textLayer: anchor.textLayer, range,
      anchorItem: anchor.itemIndex, anchorChar: anchor.localChar, level: 'word', fromTap: false,
    };
    setSelLevel(null); // hide 확장 for drag selections
    positionRowForSelection(anchor.wrapper);
    dismissDragHint();
  }, [renderSelectionRange, positionRowForSelection, setSelectedText, dismissDragHint]);

  /** Clear the selection and its overlay. */
  const dismissSelection = useCallback(() => {
    clearSelectionOverlay();
    selectionRef.current = null;
    setSelLevel(null);
    setFloatingBtn(null);
    scrollStartRef.current = null;
    if (!useStore.getState().showTranslation) setSelectedText('');
  }, [clearSelectionOverlay, setSelectedText]);

  /** 확장 button: grow word -> sentence -> paragraph from the original tap anchor. */
  const handleExpand = useCallback(() => {
    const cur = selectionRef.current;
    if (!cur || !cur.fromTap) return;
    const lvl = nextLevel(cur.level);
    selectAtAnchor(
      { itemIndex: cur.anchorItem, localChar: cur.anchorChar, textLayer: cur.textLayer, wrapper: cur.wrapper },
      lvl,
    );
  }, [selectAtAnchor]);
```

- [ ] **Step 2: Clear the overlay when a translation starts**

In `handleTranslateClick` (lines 65–73), add overlay cleanup. Replace the existing body:

```ts
  const handleTranslateClick = useCallback(() => {
    if (selectedText) {
      translate(selectedText);
      setFloatingBtn(null);
      clearSelectionOverlay();
      selectionRef.current = null;
      setSelLevel(null);
      dismissDragHint();
      // Delay removeAllRanges so translate's state update lands first
      setTimeout(() => window.getSelection()?.removeAllRanges(), 50);
    }
  }, [selectedText, translate, dismissDragHint, clearSelectionOverlay]);
```

(Note: `clearSelectionOverlay` is defined in Task 4, which is above `handleTranslateClick` in source order only if you keep Task 4's helpers below this. Since `handleTranslateClick` is at line 65 and the helpers are at ~640, move the four overlay helpers `ensureSelectionLayer`/`createSelectionMark`/`clearSelectionOverlay`/`renderSelectionRange`/`positionRowForSelection` is fine — `useCallback` refs are hoisted within the component closure at call time. No reordering needed; React function components evaluate top-to-bottom but `handleTranslateClick`'s callback only *runs* on click, after all are defined. The dependency `clearSelectionOverlay` is referenced lazily.)

- [ ] **Step 3: Verify it compiles**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/PDFViewer.tsx
git commit -m "feat(mobile): tap/expand/drag/dismiss selection actions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Touch gesture detection effect

**Files:**
- Modify: `src/components/PDFViewer.tsx` (add a new effect after the existing pinch-zoom effect, which ends at line 229)

- [ ] **Step 1: Add the tap / long-press-drag gesture effect**

After the pinch-zoom effect's closing `}, [pdfDoc, setScale, viewerMode]);` (line 229) add:

```ts
  // ===== Mobile tap-to-select (touch only) =====
  useEffect(() => {
    const container = viewerMode === 'scroll'
      ? scrollContainerRef.current
      : canvasContainerRef.current?.parentElement;
    if (!container || !pdfDoc) return;

    const TAP_MOVE = 10;   // px before a touch counts as a drag/scroll
    const TAP_MS = 350;    // max duration for a tap
    const LP_MS = 250;     // hold before a drag becomes a selection-extend

    let startX = 0, startY = 0, startTime = 0;
    let moved = false, longPress = false;
    let lpTimer: ReturnType<typeof setTimeout> | null = null;
    let anchor: TapAnchor | null = null;

    const wrapperOf = (textLayer: HTMLElement): HTMLElement =>
      (viewerMode === 'scroll'
        ? textLayer.closest('[data-page]')
        : textLayer.parentElement) as HTMLElement;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { if (lpTimer) clearTimeout(lpTimer); longPress = false; anchor = null; return; }
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY; startTime = Date.now();
      moved = false; longPress = false;
      const resolved = resolveTouchPoint(startX, startY);
      anchor = resolved
        ? { itemIndex: resolved.itemIndex, localChar: resolved.localChar, textLayer: resolved.textLayer, wrapper: wrapperOf(resolved.textLayer) }
        : null;
      if (lpTimer) clearTimeout(lpTimer);
      lpTimer = setTimeout(() => { if (!moved && anchor) longPress = true; }, LP_MS);
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - startX) > TAP_MOVE || Math.abs(t.clientY - startY) > TAP_MOVE) moved = true;
      if (longPress && anchor) {
        e.preventDefault(); // stop scrolling while extending selection
        const cur = resolveTouchPoint(t.clientX, t.clientY);
        if (cur && cur.textLayer === anchor.textLayer) {
          applyDragSelection(anchor, { itemIndex: cur.itemIndex, localChar: cur.localChar });
        }
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
      if (longPress) { longPress = false; return; } // drag-extend already applied
      const dt = Date.now() - startTime;
      if (!moved && dt <= TAP_MS) {
        const target = e.target as HTMLElement;
        if (target.closest('[data-sel-control]')) return; // tapping our own buttons
        if (anchor) selectAtAnchor(anchor, 'word');
        else dismissSelection();
      }
    };

    container.addEventListener('touchstart', onStart, { passive: true });
    container.addEventListener('touchmove', onMove, { passive: false });
    container.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      if (lpTimer) clearTimeout(lpTimer);
      container.removeEventListener('touchstart', onStart);
      container.removeEventListener('touchmove', onMove);
      container.removeEventListener('touchend', onEnd);
    };
  }, [pdfDoc, viewerMode, selectAtAnchor, applyDragSelection, dismissSelection]);
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/PDFViewer.tsx
git commit -m "feat(mobile): touch tap + long-press-drag gesture detection

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Floating row — add the 확장 button

**Files:**
- Modify: `src/components/PDFViewer.tsx` (floating button element, lines 1117–1135)

- [ ] **Step 1: Replace the single translate button with a `[번역] [확장]` row**

Replace the `floatingBtnEl` block (lines 1117–1135) with:

```tsx
  // Floating translate (+ expand) row near selection (works on all devices)
  const floatingBtnEl = floatingBtn && selectedText && !showTranslation && (
    <div
      data-sel-control
      className="fixed z-50 animate-in fade-in flex items-center gap-1.5"
      style={{ left: `${floatingBtn.x}px`, top: `${floatingBtn.y}px`, transform: floatingBtn.useAbove ? 'translateY(-100%)' : undefined }}
    >
      <button
        data-sel-control
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleTranslateClick}
        aria-label="선택한 텍스트 번역"
        className="px-3.5 py-2.5 bg-blue-600 text-white text-sm rounded-lg shadow-lg
                   hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        번역
      </button>
      {selLevel && selLevel !== 'paragraph' && (
        <button
          data-sel-control
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleExpand}
          aria-label="선택 범위 확장"
          className="px-3 py-2.5 bg-white text-blue-700 text-sm rounded-lg shadow-lg border border-blue-200
                     hover:bg-blue-50 active:bg-blue-100 transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          확장
        </button>
      )}
    </div>
  );
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/PDFViewer.tsx
git commit -m "feat(mobile): add 확장 button to floating selection row

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Dismiss/clear integration + hint copy

**Files:**
- Modify: `src/components/PDFViewer.tsx` (scale effect lines 160–164; scroll-dismiss effect lines 1041–1070; drag-hint element lines 1138–1143)

- [ ] **Step 1: Clear the selection on zoom/scale change**

The scale effect at lines 160–164 currently is:

```ts
  useEffect(() => {
    scaleRef.current = scale;
    setFloatingBtn(null);
  }, [scale]);
```

Replace it with (clears the now-stale overlay; page/scroll re-render rebuilds layers):

```ts
  useEffect(() => {
    scaleRef.current = scale;
    setFloatingBtn(null);
    clearSelectionOverlay();
    selectionRef.current = null;
    setSelLevel(null);
  }, [scale, clearSelectionOverlay]);
```

- [ ] **Step 2: Clear the selection when it scrolls out of view**

In the scroll-dismiss effect (lines 1041–1070), the two branches currently call only `setFloatingBtn(null)` / reset `scrollStartRef`. Update both branches to also drop the custom selection. Replace the `handleScroll` body's dismiss points:

Find (inside the `if (rangeRect.bottom < ... )` block, ~line 1059–1062):

```ts
        if (rangeRect.bottom < containerRect.top || rangeRect.top > containerRect.bottom) {
          setFloatingBtn(null);
          scrollStartRef.current = null;
        }
```

Replace with:

```ts
        if (rangeRect.bottom < containerRect.top || rangeRect.top > containerRect.bottom) {
          setFloatingBtn(null);
          scrollStartRef.current = null;
        }
        // Custom (touch) selection has no window range; dismiss it once scrolled far.
        if (selectionRef.current) {
          clearSelectionOverlay();
          selectionRef.current = null;
          setSelLevel(null);
          setFloatingBtn(null);
          scrollStartRef.current = null;
        }
```

And in the `else` branch (~line 1063–1066), it already nulls `floatingBtn`/`scrollStartRef`; add overlay cleanup right after `setFloatingBtn(null);`:

```ts
      } else {
        setFloatingBtn(null);
        scrollStartRef.current = null;
        if (selectionRef.current) { clearSelectionOverlay(); selectionRef.current = null; setSelLevel(null); }
      }
```

Add `clearSelectionOverlay` to this effect's dependency array (line 1070): change `}, [pdfDoc, viewerMode]);` to `}, [pdfDoc, viewerMode, clearSelectionOverlay]);`.

- [ ] **Step 3: Update the drag-hint copy to reflect tapping**

The drag-hint element (lines 1138–1143) text is `💡 텍스트를 드래그하면 바로 번역돼요`. Replace that span text:

```tsx
      <span>💡 단어를 탭하면 바로 번역돼요</span>
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PDFViewer.tsx
git commit -m "feat(mobile): clear tap-selection on zoom/scroll; update hint copy

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Full manual verification in the real renderer

**Files:** none (verification only)

Follows the verification-grounding loop: run in the real renderer, observe behavior, fix what you see, re-run. Use Chrome DevTools device emulation (touch enabled) and, if available, a physical phone on the dev server's LAN URL.

- [ ] **Step 1: Start the app and load a text-based PDF**

Run: `npm run dev`
Open the printed URL, enable device toolbar (touch), and upload a text PDF (e.g., an academic paper).

- [ ] **Step 2: Verify tap → word**

Tap a word. Expected: only that word gets the blue selection highlight; the `[번역] [확장]` row appears above it (below only when the word is at the very top). No OS selection toolbar/handles appear.

- [ ] **Step 3: Verify expand word → sentence → paragraph**

Tap 확장 once → selection grows to the full sentence (across line breaks). Tap 확장 again → grows to the paragraph; the 확장 button disappears at paragraph level. The highlighted text matches what reads as the sentence/paragraph.

- [ ] **Step 4: Verify translate**

With a sentence selected, tap 번역. Expected: the TranslationPanel opens and translates exactly the highlighted text; the selection overlay clears.

- [ ] **Step 5: Verify long-press-drag extend**

Press and hold on a word (~0.25s) then drag across text without lifting. Expected: the selection extends from the anchor word to the word under the finger; the page does not scroll during the drag; 확장 is hidden for drag selections; 번역 translates the dragged range.

- [ ] **Step 6: Verify scroll & pinch still work**

A plain one-finger swipe (no hold) scrolls normally. A two-finger pinch zooms (and the selection clears on zoom). Tapping empty margin dismisses the selection.

- [ ] **Step 7: Verify both viewer modes**

Repeat Steps 2–4 in the other viewer mode (toggle page/scroll). Selection, expand, and translate work in both.

- [ ] **Step 8: Verify desktop is unchanged**

Disable device emulation (mouse). Drag-select text with the mouse → the existing native selection + 번역 button still works exactly as before.

- [ ] **Step 9: Re-run unit tests and lint**

Run: `npm test && npm run lint`
Expected: tests PASS, lint clean.

- [ ] **Step 10: Commit any fixes made during verification**

```bash
git add -A -- src/
git commit -m "fix(mobile): tap-select adjustments from renderer verification

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(If no fixes were needed, skip this commit.)

---

## Self-Review

**Spec coverage:**
- Tap → word selection → Tasks 5 (`selectAtAnchor`), 6 (gesture). ✓
- Expand word → sentence → paragraph → Tasks 1 (`expandSelection`/`nextLevel`), 5 (`handleExpand`), 7 (button). ✓
- `[번역] [확장]` row → Task 7. ✓
- Custom overlay, no `window.getSelection()` on touch → Tasks 2 (coarse-pointer disable), 4 (overlay render). ✓
- Hit-testing with caret fallbacks → Task 3 (`resolveTouchPoint`). ✓
- Word/sentence/paragraph boundaries + heuristic caveats → Task 1. ✓
- Long-press-drag secondary → Tasks 5 (`applyDragSelection`), 6. ✓
- Page + scroll mode, single-page scope → Task 6 (`wrapperOf`), 4 (per-wrapper layer). ✓
- Clear on zoom; dismiss on scroll/empty-tap/translate → Tasks 5, 8. ✓
- Pinch-zoom & desktop mouse untouched → Task 6 (ignores `touches.length !== 1`), 2 (`pointer: coarse` only). ✓
- Hint copy update → Task 8. ✓
- Text-extraction-failed pages → graceful no-op (Task 6: `resolveTouchPoint` returns null → tap dismisses, no crash). ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code. ✓

**Type consistency:** `SelItem`/`SelectionRange`/`SelectionLevel` defined in Task 1 and imported in Task 3; `expandSelection`, `buildSelectionText`, `nextLevel`, `findArrayIndex` names match across Tasks 1/5; `selectionRef`/`selLevel`/`clearSelectionOverlay`/`renderSelectionRange`/`positionRowForSelection`/`selectAtAnchor`/`applyDragSelection`/`dismissSelection`/`handleExpand`/`TapAnchor` names are consistent across Tasks 4–8; `data-sel-control` used in Tasks 6 (guard) and 7 (markup). ✓
