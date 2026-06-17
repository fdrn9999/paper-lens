# Mobile Tap-to-Select for Translation — Design

**Date:** 2026-06-18
**Component:** `src/components/PDFViewer.tsx` (+ `src/app/globals.css`)
**Status:** Approved — ready for implementation planning

## Problem

On mobile, selecting text to translate is uncomfortable and frequently inaccurate.

Current mechanism: mobile relies on the **native browser selection** (long-press → drag the OS
selection handles) over a transparent pdfjs text layer. A debounced (100ms) `selectionchange`
listener then shows the floating 번역 button. To distinguish scrolling from selecting, a heuristic
treats any finger movement `>10px` vertical as a *scroll* and suppresses the button.

Root causes of the pain:

1. The drag hint says "드래그하면 번역" but a plain touch-drag **scrolls** — you must long-press
   first, which is undiscoverable. Hint and reality mismatch.
2. Native selection handles snap imprecisely over the transparent, `scaleX`-transformed text spans,
   so users grab the wrong words.
3. The `>10px = scroll` heuristic collides with deliberate drag-selection, sometimes dropping the
   floating button entirely.

**Key constraint that shapes the design:** `selectedText` is consumed by exactly one feature —
translation (confirmed: `PDFViewer.handleTranslateClick`, `TranslationPanel`, store `translate`).
There is no copy/search/quote consumer. So the goal is not pixel-perfect general-purpose selection;
it is a fast, precise way to capture "the text the user wants translated."

## Decisions (from brainstorming)

- **Direction:** Add **tap-based selection** as the primary mobile path; keep drag as a secondary
  fine-control option.
- **Tap unit:** A single tap selects the **word**, with an **expand** affordance to grow the range.
- **Expansion:** An explicit **확장 (expand) button** next to 번역; each press grows
  **word → sentence → paragraph**. (Chosen over double/triple-tap to avoid browser double-tap-zoom
  conflicts, and over drag-to-expand to avoid reintroducing touch-precision problems.)
- **Implementation:** **Custom selection overlay** — do not use `window.getSelection()` on touch.
  Track selection as item/char offsets and render it with the highlight-rect primitives already in
  `PDFViewer.tsx`. This removes the OS selection toolbar and jumpy native handles entirely. (Chosen
  over a native-selection-driven approach, which would keep some of the original discomfort.)

## Interaction model (touch input only)

Desktop mouse behavior is unchanged; the new engine is gated to touch input.

- **Tap a word** → that word is selected; a floating `[번역] [확장]` row appears above the selection
  (falling back below only when there is no room, reusing existing `useAbove` logic).
- **확장** → grows the selection in steps **word → sentence → paragraph**, anchored on the originally
  tapped word. The 확장 control is hidden once the selection is at paragraph level.
- **번역** → translates the current `selectedText` via the existing `translate()` path.
- **Long-press, then drag** (secondary) → extends the selection from the anchor word to the word
  under the finger. A short hold-threshold (≈250ms) before drag-extend disambiguates select from
  scroll, replacing the fragile `>10px = scroll` heuristic.
- **Plain drag / vertical swipe** (no hold) → scrolls, as today.
- Tapping empty space, scrolling past a threshold, tapping elsewhere, or a successful translate
  dismisses the selection (reusing current dismiss logic).

## Architecture

### Hit-testing (point → text position)

On tap, resolve the touch point to a text item + char offset:

1. `document.caretRangeFromPoint(x, y)` (WebKit/Blink).
2. Fallback `document.caretPositionFromPoint(x, y)` (Firefox).
3. Last resort: `document.elementFromPoint` → nearest `.textLayer span[data-item-index]`, then
   estimate the char index by x-position within the span using `measureText` (the same width
   measurement technique already used for rendering).

The resolved node lives inside a `.textLayer span[data-item-index]`, yielding
`(itemIndex, charOffset)`. Text-layer spans are already valid hit targets (highlight layers are
`pointer-events: none`).

### Boundary expansion

Driven by the extracted page text (`pageTextContents[page].items`, already in DOM order):

- **Word** — expand around the offset to word boundaries using the existing unicode token regex
  (`/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu`). Stays within the tapped span.
- **Sentence** — concatenate the page's item texts using the same line-join rules as
  `cleanSelectionText`, map the tapped position into the concatenated string, scan outward to
  sentence terminators (`. ! ? 。 ！ ？` plus trailing closing quotes/brackets, with simple decimal
  and abbreviation guards), then map the resulting span back to
  `(startItem, startChar) … (endItem, endChar)`.
- **Paragraph** — expand outward from the sentence until a large vertical gap (≈ `>1.5 ×` line
  height) between consecutive items, or page edge.

**Honest caveat:** sentence and especially paragraph detection on extracted PDF text is heuristic.
Word and sentence are the reliable wins; paragraph is best-effort and may occasionally over- or
under-select. This is acceptable given selection only feeds translation, which tolerates approximate
ranges.

### Selection state & rendering

- State (component-level): `{ page, startItem, startChar, endItem, endChar, level, anchorItem,
  anchorChar }`, where `level ∈ {word, sentence, paragraph, custom}` (`custom` = drag-extended).
- A new **`pdf-selection-layer`** is added per page wrapper as a sibling to `pdf-highlight-layer`
  (`pointer-events: none`, styled with the existing `::selection` blue `rgba(0,100,200,0.3)`,
  distinct z-index below the text layer).
- Rendering loops items `start..end` and reuses `createHighlightMark` / `computeHighlightRect`
  (generalized to accept a CSS class + color and target layer):
  - first item: `startChar` → end of its text,
  - middle items: full text,
  - last item: start → `endChar`.
  Multi-line ranges fall out naturally because each span is positioned independently.
- The selected text string is assembled from the extracted item texts (cleaned with the existing
  `cleanSelectionText` rules) and written directly to `selectedText`. `window.getSelection()` is
  never touched on the touch path → no OS toolbar, no native handles.

### Floating `[번역] [확장]` row

Extends the current single floating-button element into a small row:

- 번역 — existing `handleTranslateClick`.
- 확장 — shown only for tap-originated selections below paragraph level; `onClick` bumps `level` and
  recomputes boundaries from the anchor, re-renders, updates `selectedText`, and repositions the row.
- Both controls are excluded from the dismiss handlers (same pattern as the current
  `aria-label="선택한 텍스트 번역"` guard) so interacting with them does not clear the selection.
- Positioned via the existing `floatingBtn` `{x, y, useAbove}` logic.

### Coexistence

- **Page mode & scroll mode** — the selection layer attaches to the wrapper of the tapped page
  (`canvasContainerRef`'s wrapper in page mode; the `[data-page]` wrapper in scroll mode). Selection
  is restricted to a single page (the anchor's page).
- **Zoom/scale change** — clear the selection on scale change (consistent with the current
  `setFloatingBtn(null)` on scale), avoiding stale-rect re-sync complexity.
- **Pinch-zoom** — the two-finger handler is untouched; the tap engine ignores any interaction with
  `touches.length > 1`.
- **Desktop mouse** — existing `handleMouseDown` / `handleMouseUp` / `selectionchange` paths remain
  for non-touch input.
- **Drag hint copy** — update from "텍스트를 드래그하면 바로 번역돼요" to a tap-oriented message
  (e.g., "단어를 탭하면 바로 번역돼요"). localStorage key and dismiss behavior unchanged.
- **Text-extraction-failed pages** — no tappable text items → tap is a graceful no-op.

## Out of scope

- RTL / vertical-script text selection.
- Cross-page selection in scroll mode.
- Copy / quote / search-from-selection (no such consumer exists).
- Changing desktop selection behavior.

## Testing

Manual verification in the real renderer (mobile emulation in dev tools, plus a physical device
where possible):

- Tapping a word selects the correct word; the `[번역] [확장]` row appears above it.
- 확장 grows the selection word → sentence → paragraph; 확장 disappears at paragraph level.
- 번역 sends exactly the highlighted text to translation.
- Long-press-then-drag extends the selection; a plain swipe still scrolls; tap-vs-scroll is not
  confused.
- Pinch-zoom and page navigation still work; selection clears on zoom.
- Works in both page and scroll viewer modes.
- Desktop mouse selection + translate is unchanged.

Follows the verification-grounding loop: run in the real renderer, observe the behavior, fix what is
seen, re-run.
