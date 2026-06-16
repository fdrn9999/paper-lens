# PaperLens UI/UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 15 audited UI/UX issues across 5 clusters (discoverability, feedback/state, consistency, mobile/responsive, accessibility) and add a discoverability layer, without rewriting any subsystem.

**Architecture:** Targeted edits on the stabilized `main`. Introduce two cross-cutting tokens first — a documented z-index scale in `globals.css` and a purple "AI semantic" color role — then apply per-component fixes. Discoverability is hybrid: always-on affordances plus a promoted guide entry point.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5.7, Zustand 5, Tailwind 3.4, pdfjs-dist.

**Verification note:** This project has NO test framework. The TDD "write a failing test" step is replaced per task by: (a) `npx tsc --noEmit` as the type gate, and (b) a concrete browser observation following the fablize grounding loop (run in the real renderer, observe, fix what you see). Each task ends with `npx tsc --noEmit`, a stated observation, and a commit. Run `npm run build` once at the end (Task 16-equivalent final review). Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**Scope guard:** `src/app/page.tsx` has pre-existing uncommitted WIP (footer links to `/about` and `/guide`, plus new `src/app/about/` and `src/app/guide/` dirs). Task 14 touches `page.tsx` — stage ONLY the header guide-replay lines, never `git add` the whole file or the about/guide dirs.

---

## Cross-cutting tokens (Tasks 1–3 introduce them; later tasks consume them)

### Task 1: globals.css — z-index scale + reduced-motion guard

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add z-index scale documentation comment**

After the top-of-file comment block (around line 7, before the first `:root`/`@layer`), add:

```css
/* ============================================================
   z-index scale (stacking order, low → high)
   Use these tiers; do not invent new ad-hoc z-[NNN] values.
     base / highlight        : 0–10   (in-flow content, text highlights)
     header                  : 40
     drawer-backdrop         : 30
     drawer                  : 35
     floating-action         : 50     (PDF floating translate button)
     popover                 : 50     (Help/Usage popovers)
     cookie                  : 60     (cookie consent bar)
     toast                   : 100    (transient notifications)
     guide-overlay           : 200    (onboarding tour; above everything)
       guide spotlight       : 201
       guide tooltip         : 202
   ============================================================ */
```

- [ ] **Step 2: Add prefers-reduced-motion guard**

At the END of the file, append:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors (CSS-only change; tsc confirms nothing else broke).

- [ ] **Step 4: Observe**

Run `npm run dev`, open the app, and in DevTools enable "Emulate CSS prefers-reduced-motion: reduce". Confirm the sidebar/toast slide-in animations no longer visibly animate. The comment block is documentation; no visual change expected from Step 1.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): add z-index scale doc + prefers-reduced-motion guard"
```

---

### Task 2: Toast — correct z-tier + role split

**Files:**
- Modify: `src/components/Toast.tsx:35,39`

- [ ] **Step 1: Lower container z-index to the toast tier**

Find the container (line 35) `z-[200]` and change it to `z-[100]` so the guide overlay (200) sits above toasts.

```tsx
// before:  className="... z-[200] ..."
// after:   className="... z-[100] ..."
```

- [ ] **Step 2: Split role by type**

The toast element (line 39) currently has a static `role="alert"`. Make informational toasts polite and only errors assertive:

```tsx
role={toast.type === 'error' ? 'alert' : 'status'}
aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Observe**

Trigger a toast (e.g. dispatch `paperlens-toast`). Confirm it still appears top/bottom as before. Inspect the DOM: an info toast shows `role="status"`, an error toast `role="alert"`.

- [ ] **Step 5: Commit**

```bash
git add src/components/Toast.tsx
git commit -m "fix(a11y): toast z-tier to 100 and role status/alert by type"
```

---

### Task 3: CookieConsent — cookie z-tier

**Files:**
- Modify: `src/components/CookieConsent.tsx`

- [ ] **Step 1: Find current z-index**

Run: search the file for `z-[150]` (the value noted in the design's measured list).

- [ ] **Step 2: Change to cookie tier**

Replace `z-[150]` with `z-[60]` so the order is drawer < floating/popover < cookie < toast < guide.

```tsx
// before:  z-[150]
// after:   z-[60]
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Observe**

With consent not yet given, confirm the cookie bar shows, sits above page content, and that a toast (z-100) appears above it.

- [ ] **Step 5: Commit**

```bash
git add src/components/CookieConsent.tsx
git commit -m "fix(ui): cookie consent to z-tier 60"
```

---

## Cluster ③ Consistency

### Task 4: SearchBar — 3-state button label

**Files:**
- Modify: `src/components/SearchBar.tsx:164-172`

- [ ] **Step 1: Make submit label reflect whether search terms exist**

`searchTerms` is in scope (line 144). The submit button text literal is `추가` (line ~166). Change it so an empty term list reads "검색" and a non-empty list reads "추가":

```tsx
{searchTerms.length > 0 ? '추가' : '검색'}
```

(The cancel button `취소` and the active-search states are unchanged — this completes the 3-state set: 검색 / 추가 / 취소.)

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Observe**

Open search with no terms added → button reads "검색". Add one term → button reads "추가". Start a search → "취소" appears as before.

- [ ] **Step 4: Commit**

```bash
git add src/components/SearchBar.tsx
git commit -m "fix(ui): search button shows 검색 when no terms, 추가 otherwise"
```

---

### Task 5: ChatPanel — AI purple + always-visible char counter

**Files:**
- Modify: `src/components/ChatPanel.tsx:292,355,379,382,391`

- [ ] **Step 1: User bubble → purple**

Line 292 user bubble `bg-blue-500 text-white rounded-br-sm` → swap blue for purple:

```tsx
// before: bg-blue-500 text-white rounded-br-sm
// after:  bg-purple-500 text-white rounded-br-sm
```

- [ ] **Step 2: Example-question chips → purple**

Line ~355 `border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100`:

```tsx
// after: border-purple-200 text-purple-600 bg-purple-50 hover:bg-purple-100
```

- [ ] **Step 3: Textarea focus ring → purple**

Line ~379 `focus:ring-blue-400`:

```tsx
// after: focus:ring-purple-400
```

- [ ] **Step 4: Send button → purple**

Line ~391 `bg-blue-500 ... hover:bg-blue-600`:

```tsx
// after: bg-purple-500 ... hover:bg-purple-600
```

- [ ] **Step 5: Always-visible char counter with near-limit warning**

The counter currently renders only when `input.length > 0` (line ~382), and `handleInputChange` silently caps at `MAX_CHARS` (2000, lines 157-161). Make the counter always visible and warn as it approaches/hits the cap. Replace the conditional counter with an always-rendered one:

```tsx
<span
  className={
    input.length >= MAX_CHARS
      ? 'text-red-500'
      : input.length >= MAX_CHARS * 0.9
        ? 'text-amber-500'
        : 'text-gray-400'
  }
>
  {input.length}/{MAX_CHARS}
</span>
```

(Keep the existing silent cap in `handleInputChange` — the counter now makes the limit visible instead of surprising. Place this span where the old conditional counter was, removing the `input.length > 0 &&` guard.)

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Observe**

Open the AI chat tab. Confirm the user bubble, send button, focus ring, and example chips are now purple (matching the already-purple summary section). Confirm the counter shows `0/2000` on an empty input, turns amber past 1800 chars, and red at 2000.

- [ ] **Step 8: Commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "feat(ui): unify AI chat to purple + always-visible char counter"
```

---

### Task 6: PageNavigator — SVG chevrons + mobile extraction progress

**Files:**
- Modify: `src/components/PageNavigator.tsx:94,117,122`

- [ ] **Step 1: Replace prev glyph with chevron SVG**

Line ~94 prev button text `◀`:

```tsx
<svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.24a.75.75 0 0 1 0-1.06l4.25-4.24a.75.75 0 0 1 1.07 0Z" clipRule="evenodd" />
</svg>
```

- [ ] **Step 2: Replace next glyph with chevron SVG**

Line ~117 next button text `▶`:

```tsx
<svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 0-1.06L10.94 10 7.21 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.24a.75.75 0 0 1 0 1.06l-4.25 4.24a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
</svg>
```

(Keep each button's existing `aria-label`/`title` so screen readers still announce prev/next.)

- [ ] **Step 3: Show extraction progress on mobile (compact)**

Line ~122 the extraction indicator is `hidden sm:flex` with text `텍스트 추출 중 ({pageTextContents.length}/{totalPages})`. Make it visible on mobile in a compact form. Change the container to `flex` and split the label by breakpoint:

```tsx
<span className="hidden sm:inline">텍스트 추출 중 ({pageTextContents.length}/{totalPages})</span>
<span className="sm:hidden">{pageTextContents.length}/{totalPages}</span>
```

(Remove `hidden` from the container's class so it shows at all widths; keep `sm:flex` semantics by using `flex`.)

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Observe**

Confirm prev/next now render as chevron SVGs consistent with other icons. At mobile width during extraction, confirm a compact `n/total` shows; at ≥sm it reads the full "텍스트 추출 중 (n/total)".

- [ ] **Step 6: Commit**

```bash
git add src/components/PageNavigator.tsx
git commit -m "fix(ui): chevron SVGs + mobile extraction progress in PageNavigator"
```

---

## Cluster ④ Mobile / responsive

### Task 7: TranslationPanel — relax mobile original-text clamp

**Files:**
- Modify: `src/components/TranslationPanel.tsx:63`

- [ ] **Step 1: Raise the original-text max height**

Line 63 original-text box `max-h-10 sm:max-h-20` clamps the source to ~2.5 lines on mobile. Relax it:

```tsx
// before: max-h-10 sm:max-h-20
// after:  max-h-24 sm:max-h-28
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Observe**

Select a multi-line passage and translate. At mobile width, confirm the original text now shows ~5–6 lines (scroll within the box for longer) instead of 2.5, and the panel still fits within its `max-h-[40dvh]` container.

- [ ] **Step 4: Commit**

```bash
git add src/components/TranslationPanel.tsx
git commit -m "fix(mobile): relax original-text clamp in TranslationPanel"
```

---

## Cluster ② Feedback / state

### Task 8: KeywordPanel — remove nested buttons (a11y)

**Files:**
- Modify: `src/components/KeywordPanel.tsx:90-104,188`

- [ ] **Step 1: Convert the outer card button to a div with button semantics**

`KeywordCard`'s outer element is a `<button>` (lines 90-104) that contains nested buttons (add-to-search line ~121, page badges ~153-176) — invalid HTML. Convert the outer to a focusable div that keeps keyboard activation:

```tsx
<div
  role="button"
  tabIndex={0}
  onClick={handleCardClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  }}
  className={/* keep the existing className from the old <button> */}
>
```

Use the existing click handler the old `<button>` used as `handleCardClick` (if it was an inline arrow, extract it to a named const above the return, or inline the same body in both `onClick` and `onKeyDown`). The closing tag at line ~188 changes from `</button>` to `</div>`.

- [ ] **Step 2: Stop inner-button clicks from bubbling to the card**

On the inner add-to-search button (~121) and page badge buttons (~153-176), ensure their `onClick` calls `e.stopPropagation()` first so activating them does not also trigger the card.

```tsx
onClick={(e) => { e.stopPropagation(); /* existing handler body */ }}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Observe**

Inspect a keyword card: no `<button>` nested inside another `<button>`. Tab to a card → it's focusable; Enter/Space activates it. Clicking the add-to-search button or a page badge performs only that action, not the card action.

- [ ] **Step 5: Commit**

```bash
git add src/components/KeywordPanel.tsx
git commit -m "fix(a11y): KeywordCard div role=button to remove nested buttons"
```

---

### Task 9: ResultList — aria-activedescendant

**Files:**
- Modify: `src/components/ResultList.tsx:129-133,344`

- [ ] **Step 1: Give each option a stable id**

The option element (lines 129-133) is `<button role="option" aria-selected={isCurrent}>`. Add an id keyed by result id:

```tsx
id={`result-option-${result.id}`}
```

- [ ] **Step 2: Point the listbox at the active option**

The container (line 344) is `role="listbox" tabIndex={0}` with no `aria-activedescendant`. Add it using the in-scope current-selection variable (the same value that drives `isCurrent`):

```tsx
aria-activedescendant={currentResultId ? `result-option-${currentResultId}` : undefined}
```

(Use whatever the existing variable is named for "the currently highlighted result id" — match the source of `isCurrent`. If `isCurrent` is computed as `result.id === currentId`, then `currentId` is that variable.)

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Observe**

Run a search with results. Inspect the listbox: `aria-activedescendant` matches the id of the currently-highlighted option, and updates as the current result changes.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResultList.tsx
git commit -m "fix(a11y): aria-activedescendant on result listbox"
```

---

### Task 10: Text-extraction failure — store flag + toast + empty-state copy

**Files:**
- Modify: `src/store/useStore.ts` (interface ~91, setter type ~146, initial ~200, impl ~300-302, resets ~260 and ~783)
- Modify: `src/components/PDFViewer.tsx:246-251`
- Modify: `src/components/KeywordPanel.tsx:242-250`

- [ ] **Step 1: Add `textExtractionFailed` to the store, mirroring `isExtracting`**

In `useStore.ts`, add a parallel boolean field and setter wherever `isExtracting` appears:

```ts
// in the state interface (near line 91):
textExtractionFailed: boolean;
// in the actions interface (near line 146):
setTextExtractionFailed: (failed: boolean) => void;
// in the initial state (near line 200):
textExtractionFailed: false,
// in the setter implementations (near line 300):
setTextExtractionFailed: (failed) => set({ textExtractionFailed: failed }),
```

In BOTH reset paths (`setPdfData` reset block ~260 and the `reset` action ~783), set `textExtractionFailed: false` alongside the existing `isExtracting: false`.

- [ ] **Step 2: On extraction failure, set the flag and show a toast**

In `PDFViewer.tsx` the extraction effect catch is lines 246-248 (`if (!cancelled && process.env.NODE_ENV !== 'production') console.error(...)`). Add user-facing feedback (keep the existing dev log). PDFViewer already dispatches `paperlens-toast` via CustomEvent elsewhere — use the same pattern, and set the new flag:

```tsx
if (!cancelled) {
  setTextExtractionFailed(true);
  window.dispatchEvent(new CustomEvent('paperlens-toast', {
    detail: { text: '이 PDF는 텍스트 추출이 어렵습니다. 검색·키워드 기능이 제한될 수 있어요.', type: 'error' },
  }));
  if (process.env.NODE_ENV !== 'production') console.error('Text extraction failed', err);
}
```

Select `setTextExtractionFailed` from the store at the top of the component (alongside the existing `setIsExtracting` selection at line ~37), and add it to the effect's dependency array (line 251) next to `setIsExtracting`.

- [ ] **Step 3: Show empty-state copy in KeywordPanel when extraction failed**

KeywordPanel's "No text extracted yet" empty state is lines 242-250. Read `textExtractionFailed` from the store and, when true, show the failure message instead of the neutral "not yet" copy:

```tsx
{textExtractionFailed
  ? '이 PDF에서는 텍스트를 추출하지 못해 키워드를 만들 수 없습니다.'
  : /* existing "아직 추출되지 않음" copy */}
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Observe**

Load an image-only/scanned PDF (no extractable text). Confirm an error toast appears and the keyword panel shows the failure copy rather than a perpetual "not yet" state. Load a normal PDF and confirm no toast and normal keyword behavior (flag resets between documents).

- [ ] **Step 6: Commit**

```bash
git add src/store/useStore.ts src/components/PDFViewer.tsx src/components/KeywordPanel.tsx
git commit -m "feat(feedback): surface text-extraction failure via toast + empty state"
```

---

### Task 11: PDFViewer — scroll-mode loading placeholder

**Files:**
- Modify: `src/components/PDFViewer.tsx:1120-1134`

- [ ] **Step 1: Replace empty page boxes with a skeleton/loading state**

In scroll mode, lines 1120-1134 render self-closing relative `<div>` boxes for pages not yet rendered (blank white). Give the not-yet-rendered box a visible loading affordance — a centered spinner/skeleton — so users see "loading" instead of blank:

```tsx
<div className="relative ... flex items-center justify-center bg-gray-50">
  <div className="flex flex-col items-center gap-2 text-gray-400">
    <span className="inline-block w-6 h-6 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" aria-hidden="true" />
    <span className="text-xs">페이지 불러오는 중…</span>
  </div>
</div>
```

(Keep the box's existing sizing/positioning classes — only add the flex-centering and the inner loading content.)

- [ ] **Step 2: Confirm the placeholder is replaced on render**

The render code mounts the page canvas into this box once the page is ready. If that code resets the box's children before appending the canvas, the placeholder is removed automatically — that is the desired behavior. If instead the canvas is appended alongside, conditionally render the loading content only while the page has not yet been rendered (track with the existing rendered-pages state if present, otherwise gate on the canvas-ref being unset). Prefer the conditional render so the spinner never overlaps a rendered page.

- [ ] **Step 3: Verify reduced-motion**

The Task 1 reduced-motion guard already neutralizes `animate-spin`. No extra work — just confirm the spinner is static under emulated reduced-motion.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Observe**

Open a multi-page PDF in scroll mode and scroll quickly. Confirm not-yet-rendered pages show the spinner + "페이지 불러오는 중…" instead of a blank white box, and the spinner disappears once the page renders.

- [ ] **Step 6: Commit**

```bash
git add src/components/PDFViewer.tsx
git commit -m "feat(feedback): scroll-mode loading placeholder for unrendered pages"
```

---

### Task 12: PDFViewer — floating translate button above selection (mobile)

**Files:**
- Modify: `src/components/PDFViewer.tsx:990-994,1090-1109`

- [ ] **Step 1: Position the floating button above the selection**

The button's y is computed at lines 990-994 as `belowY = rangeRect.bottom + 8` (below the selection), which on mobile collides with the OS selection toolbar. Compute an above-selection position and prefer it when there's room:

```tsx
const aboveY = rangeRect.top - 8;   // place button's bottom edge here
const belowY = rangeRect.bottom + 8;
// prefer above; fall back below only if there isn't room at the top
const useAbove = rangeRect.top > 56; // ~button height + margin
```

- [ ] **Step 2: Apply the chosen position to the floating button element**

In the floating button element (lines 1090-1109), use `useAbove` to set the vertical position and a transform so the button sits fully above the selection when `useAbove` is true:

```tsx
style={{
  left: floatingBtnX,
  top: useAbove ? aboveY : belowY,
  transform: useAbove ? 'translateY(-100%)' : undefined,
}}
```

(Reuse the existing left/x variable name — match what lines 1090-1109 already use. The button stays gated behind `showTranslation` as before, and keeps its existing z-index in the floating-action tier.)

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Observe**

On a narrow viewport (mobile emulation), select text near the top and middle of the viewport. Confirm the floating translate button appears ABOVE the selection (clear of the OS toolbar) when there's room, and falls back below only when the selection is at the very top.

- [ ] **Step 5: Commit**

```bash
git add src/components/PDFViewer.tsx
git commit -m "fix(mobile): float translate button above selection to clear OS toolbar"
```

---

## Cluster ① Discoverability (hybrid)

### Task 13: PDFViewer — persistent drag-to-translate hint

**Files:**
- Modify: `src/components/PDFViewer.tsx` (PDF content area; localStorage key `paperlens-drag-hint-dismissed`)

- [ ] **Step 1: Add dismissible-hint state backed by localStorage**

Add state seeded from localStorage so the hint stays hidden once dismissed/used:

```tsx
const [showDragHint, setShowDragHint] = useState(false);
useEffect(() => {
  if (typeof window !== 'undefined' && !localStorage.getItem('paperlens-drag-hint-dismissed')) {
    setShowDragHint(true);
  }
}, []);
const dismissDragHint = useCallback(() => {
  setShowDragHint(false);
  if (typeof window !== 'undefined') localStorage.setItem('paperlens-drag-hint-dismissed', '1');
}, []);
```

(Add `useCallback` to the React import if not already present.)

- [ ] **Step 2: Render a subtle hint over the PDF area**

When `showDragHint`, render a small, low-noise pill near the bottom of the PDF content area:

```tsx
{showDragHint && (
  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-purple-600/90 px-3 py-1.5 text-xs text-white shadow-md">
    <span>💡 텍스트를 드래그하면 바로 번역돼요</span>
    <button onClick={dismissDragHint} aria-label="힌트 닫기" className="ml-1 opacity-80 hover:opacity-100">✕</button>
  </div>
)}
```

(Purple because translate is an AI feature. Place it inside the same positioned container as the floating translate button so `absolute` anchors correctly.)

- [ ] **Step 3: Auto-dismiss once the user actually translates**

Where a translation is successfully triggered from a drag/selection (the existing translate handler), call `dismissDragHint()` so the hint disappears after first real use and never returns.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Observe**

Fresh profile (clear `localStorage`): the hint shows over the PDF. Click ✕ → it disappears and stays gone after reload. Reset localStorage, reload, then translate a selection → hint disappears and does not return on reload.

- [ ] **Step 6: Commit**

```bash
git add src/components/PDFViewer.tsx
git commit -m "feat(discoverability): persistent drag-to-translate hint"
```

---

### Task 14: page.tsx — promote guide-replay to header

**Files:**
- Modify: `src/app/page.tsx:277-292` (mobile + desktop header clusters)

- [ ] **Step 1: Add a header guide button that calls `startGuide`**

`startGuide` is a store action (confirmed via HelpButton.tsx:150-158). In the header, add a compact "가이드" button next to the existing UsageButton/HelpButton in BOTH the mobile cluster (`sm:hidden flex`, ~277-280) and the desktop cluster (`hidden sm:flex`, ~289-292). Only show it when a PDF is loaded (`pdfFile` is in scope, line ~243), matching HelpButton's replay-button condition:

```tsx
{pdfFile && (
  <button
    onClick={startGuide}
    title="가이드 다시 보기"
    aria-label="가이드 다시 보기"
    className="inline-flex items-center justify-center rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
  >
    {/* desktop cluster: show text "가이드"; mobile cluster: show a ? icon */}
  </button>
)}
```

For the mobile cluster use a `?` glyph/icon; for the desktop cluster use the text "가이드". Read `startGuide` from the store at the top of the component (same store hook page.tsx already uses).

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Observe**

With a PDF loaded, confirm a guide button shows in the header at both mobile and desktop widths and clicking it starts the tour (GuideOverlay appears). With no PDF loaded, the button is absent.

- [ ] **Step 4: Commit (staging only the header lines)**

`page.tsx` has unrelated uncommitted WIP. Stage ONLY this file with an explicit path and DO NOT add `src/app/about/` or `src/app/guide/`:

```bash
git add src/app/page.tsx
git commit -m "feat(discoverability): promote guide replay to header"
```

If `git status` shows the about/guide dirs or footer WIP would be swept in, use `git add -p src/app/page.tsx` to stage only the header hunk.

---

## Cluster ⑤ Accessibility

### Task 15: GuideOverlay — focus trap, Escape, no backdrop dismiss, center fallback

**Files:**
- Modify: `src/components/GuideOverlay.tsx:3,132-141,191-197`

- [ ] **Step 1: Import useRef**

Line 3 is `import { useEffect, useState, useCallback } from 'react';` — add `useRef`:

```tsx
import { useEffect, useState, useCallback, useRef } from 'react';
```

- [ ] **Step 2: Add an Escape-to-close handler**

Add an effect that closes the tour on Escape (reusing the existing `skipGuide` action):

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') skipGuide();
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, [skipGuide]);
```

- [ ] **Step 3: Trap focus within the overlay**

Add a ref to the dialog root (line 191 `<div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">`) and a keydown handler that keeps Tab inside it:

```tsx
const dialogRef = useRef<HTMLDivElement>(null);
// on the root div: ref={dialogRef} onKeyDown={handleTabTrap}
const handleTabTrap = (e: React.KeyboardEvent) => {
  if (e.key !== 'Tab') return;
  const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
    'button, [href], input, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables || focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
};
```

Also focus the dialog on mount: in the existing mount effect (or a new one), call `dialogRef.current?.focus()` after adding `tabIndex={-1}` to the root div so it can receive focus.

- [ ] **Step 4: Stop backdrop click from ending the whole tour**

The backdrop (lines 194-197) is `<div ... onClick={skipGuide} />`, which dismisses the entire tour on any background tap. Remove the `onClick={skipGuide}` so the backdrop no longer closes the tour — closing happens only via the existing "건너뛰기" button.

```tsx
// before: <div className="..." onClick={skipGuide} />
// after:  <div className="..." />   (no onClick)
```

- [ ] **Step 5: Center-modal fallback when the target is missing**

`updatePosition` sets `setSpotlight(null)` when the target element is missing (lines 132-141, `el` null at ~138). When `spotlight` is null, the step tooltip should render as a centered modal instead of pointing at empty space. In the step-tooltip render (~242-286), when `spotlight` is null, position the tooltip in the viewport center (reuse the welcome/center modal styles at 216-241):

```tsx
// when spotlight is null, render the step tooltip with the centered modal positioning
// (same container classes as the welcome modal at 216-241) instead of the
// spotlight-anchored absolute positioning.
```

Concretely: branch the tooltip's wrapper className/style on `spotlight ? <anchored styles> : <centered modal styles>`.

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Observe**

Start the guide. (a) Press Escape → tour closes. (b) Press Tab repeatedly → focus cycles within the overlay, never reaching page content behind it. (c) Click the dark backdrop → tour does NOT close (only "건너뛰기" closes it). (d) Force a step whose target is absent (e.g. a step referencing an element not on a narrow viewport) → the tooltip shows centered rather than pinned to a corner. Also confirm a toast (z-100) now appears BENEATH the guide overlay (z-200).

- [ ] **Step 8: Commit**

```bash
git add src/components/GuideOverlay.tsx
git commit -m "fix(a11y): guide focus trap, Escape close, no backdrop dismiss, center fallback"
```

---

## Final verification (after all tasks)

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: End-to-end browser pass (fablize grounding)**

Walk the design's §5 verification checklist in the real app:
- ① drag hint shows, disappears after one translate, stays gone on reload.
- ② extraction-failure toast + keyword empty-state copy on a scanned PDF.
- ③ search button reads 검색 → 추가; chat char counter behaves.
- ④ at mobile width, bottom-fixed elements stack correctly (toast under guide, cookie under toast); floating translate button clears the OS toolbar.
- ⑤ guide closes on Escape, traps Tab, ignores backdrop click, centers when target missing.

- [ ] **Step 4: Confirm scope hygiene**

Run: `git log --oneline` and `git status`. Confirm: each task is its own commit, no commit bundled the `src/app/about/` or `src/app/guide/` WIP or unrelated footer changes, and the working tree contains only intended remaining changes.

---

## Self-Review

**1. Spec coverage** — every design work-unit maps to a task:
- ① drag hint → T13; guide entry promotion → T14; touch affordance → covered by T14 (button-style cue) + existing titles.
- ② extraction failure → T10; scroll loading placeholder → T11; chat char feedback → T5 (step 5); mobile extraction progress → T6.
- ③ search 3-state → T4; AI purple → T5; prev/next icons → T6.
- ④ z-index scale → T1–T3 (+ consumers T2/T3/T15); floating button position → T12; original-text clamp → T7.
- ⑤ guide a11y (trap/Escape/backdrop/center) → T15; nested buttons → T8; result aria → T9; toast role → T2; reduced-motion → T1.
All 15 design items + the folded-in char-counter requirement are covered.

**2. Placeholder scan** — code steps contain real before/after code, exact files/lines, and concrete observations. Where a variable name depends on existing source (e.g. `currentResultId` in T9, the left/x var in T12, the translate handler in T13), the step names the source of truth to match rather than inventing a name — intentional, because the implementer can read the one referenced line. No "TBD/handle edge cases/add validation" placeholders remain.

**3. Type consistency** — store field `textExtractionFailed` and setter `setTextExtractionFailed` are named identically in T10 across interface, initial state, setter, resets, PDFViewer, and KeywordPanel. localStorage key `paperlens-drag-hint-dismissed` is identical in T13 steps 1 and 3 and step 5. z-tier values (toast 100, cookie 60, guide 200) are consistent between T1 doc and T2/T3/T15 consumers. `skipGuide`/`startGuide` match the confirmed store actions.
