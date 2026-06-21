# Lexical Search Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tiered lexical matching (exact → accent-fold → stem → fuzzy) to in-document search so variant forms, accents, ligatures, and typos are found while exact matches always rank first.

**Architecture:** Refactor `searchEngine.ts` into a pipeline. `exactSearch` stays as Tier 0 (handles CJK/special chars/kerning). New token-based tiers (folded, stemmed, fuzzy) run only for Latin queries. A memoized per-document index (`buildPageData`) feeds all tiers. `mergeTiers` dedups by position keeping the highest (most exact) tier and sorts by tier → page → position.

**Tech Stack:** TypeScript, Node test runner (`node --test`), no new dependencies.

## Global Constraints

- No new npm dependencies. Pure TS in `src/lib/`.
- Tests run via `node --test <file.ts>` (Node native type stripping, matching existing `textSelection.test.ts`).
- Highlight positions (`itemIndex`, `charStart`, `charEnd`, `spans`) must always map to **original** item text, never folded/normalized text.
- Stemming is **conservative (option A)**: plurals + `-ing`/`-ed` only, no double-consonant restoration. `modeling↔model` matches; `running↔run` does NOT (documented limitation); `university↔universal` must NOT collide.
- Tiers 1–3 are **Latin-only**. CJK and special-char (`C++`, `O(N)`) queries use Tier 0 unchanged.
- Fuzzy (Tier 3) applies to **single-word queries only**, query length ≥ 4.

---

## File Structure

- `src/lib/searchEngine.ts` — MODIFY. Add `foldText`, `foldChar`, `stem`, `levenshtein`, `buildPageData`, `matchTokens`, `mergeTiers`, `fuzzySearch`, `searchDocument`. Keep all existing internal helpers and `exactSearch`.
- `src/lib/searchEngine.test.ts` — CREATE. Unit + integration tests.
- `src/lib/types.ts` — MODIFY. Add optional `matchTier` to `SearchResult`.
- `package.json` — MODIFY. Add `searchEngine.test.ts` to the `test` script.
- `src/store/useStore.ts` — MODIFY. Replace `exactSearch` call with `searchDocument`.

---

## Task 1: `foldText` — accent/ligature/case normalization with offset mapping

**Files:**
- Modify: `src/lib/searchEngine.ts`
- Create: `src/lib/searchEngine.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `foldChar(ch: string, lower: boolean): string`
  - `foldText(text: string, lower: boolean): { folded: string; toOriginal: number[] }` — `folded[k]` originates from `text[toOriginal[k]]`.

- [ ] **Step 1: Update the test script so the new test file runs**

In `package.json`, change the `test` script:

```json
"test": "node --test src/lib/textSelection.test.ts src/lib/searchEngine.test.ts",
```

- [ ] **Step 2: Write the failing test** — create `src/lib/searchEngine.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldText } from './searchEngine.ts';

test('foldText strips diacritics and lowercases', () => {
  const r = foldText('Café', true);
  assert.equal(r.folded, 'cafe');
  assert.equal(r.toOriginal.length, 4);
  assert.deepEqual(r.toOriginal, [0, 1, 2, 3]);
});

test('foldText expands ligatures via NFKC and maps to source index', () => {
  const r = foldText('ﬁle', true); // "ﬁle"
  assert.equal(r.folded, 'file');
  // both 'f' and 'i' originate from source index 0 (the ligature)
  assert.deepEqual(r.toOriginal, [0, 0, 1, 2]);
});

test('foldText preserves case when lower=false', () => {
  assert.equal(foldText('Café', false).folded, 'Cafe');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: FAIL — `foldText` is not exported / not a function.

- [ ] **Step 4: Implement** — add to `src/lib/searchEngine.ts` (after the imports / near the top of the helpers)

```ts
/** Fold one source character: NFKC (ligatures, width) → strip diacritics → optional lowercase. */
export function foldChar(ch: string, lower: boolean): string {
  // strip combining diacritics in the Unicode range U+0300..U+036F
  let f = ch.normalize('NFKC').normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (lower) f = f.toLowerCase();
  return f;
}

/**
 * Fold a whole string for accent/case-insensitive matching while keeping a map
 * back to the original indices (folding can change length, e.g. ﬁ → fi).
 */
export function foldText(text: string, lower: boolean): { folded: string; toOriginal: number[] } {
  let folded = '';
  const toOriginal: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const f = foldChar(text[i], lower);
    for (let k = 0; k < f.length; k++) {
      folded += f[k];
      toOriginal.push(i);
    }
  }
  return { folded, toOriginal };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/searchEngine.ts src/lib/searchEngine.test.ts package.json
git commit -m "feat(search): foldText accent/ligature/case normalization"
```

---

## Task 2: `stem` — conservative stemmer

**Files:**
- Modify: `src/lib/searchEngine.ts`
- Modify: `src/lib/searchEngine.test.ts`

**Interfaces:**
- Produces: `stem(token: string): string` — lowercase ASCII-letter tokens only; others returned unchanged.

- [ ] **Step 1: Write the failing test** — append to `searchEngine.test.ts`

```ts
import { stem } from './searchEngine.ts';

test('stem normalizes plurals and -ing/-ed to a shared form', () => {
  assert.equal(stem('model'), 'model');
  assert.equal(stem('models'), 'model');
  assert.equal(stem('modeling'), 'model');
  assert.equal(stem('learned'), 'learn');
  assert.equal(stem('studies'), 'study');
  assert.equal(stem('boxes'), 'box');
  assert.equal(stem('modes'), 'mode');   // -es after non-sibilant → drop only 's'
  assert.equal(stem('classes'), 'class'); // -es after sibilant → drop 'es'
});

test('stem is conservative: no over-stemming', () => {
  assert.equal(stem('class'), 'class');          // -ss kept
  assert.notEqual(stem('university'), stem('universal')); // must not collide
  assert.equal(stem('running'), 'runn');         // documented: no double-consonant restore
});

test('stem leaves non-latin / short / numeric tokens untouched', () => {
  assert.equal(stem('인공지능'), '인공지능');
  assert.equal(stem('is'), 'is');
  assert.equal(stem('2024'), '2024');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: FAIL — `stem` not exported.

- [ ] **Step 3: Implement** — add to `src/lib/searchEngine.ts`

```ts
/**
 * Conservative English stemmer: plurals + -ing/-ed only.
 * Operates on lowercase ASCII-letter tokens; returns others unchanged.
 * Does NOT restore double consonants (running → runn) to avoid over-stemming.
 */
export function stem(token: string): string {
  if (!/^[a-z]+$/.test(token)) return token;

  if (token.endsWith('ies') && token.length >= 5) return token.slice(0, -3) + 'y';

  if (token.endsWith('es') && token.length >= 5) {
    const dropEs = token.slice(0, -2); // boxes → box
    const dropS = token.slice(0, -1);  // modes → mode
    return /(s|x|z|ch|sh)$/.test(dropEs) ? dropEs : dropS;
  }

  if (token.endsWith('s') && !token.endsWith('ss') && token.length >= 4) return token.slice(0, -1);

  if (token.endsWith('ing') && token.length >= 6) return token.slice(0, -3);

  if (token.endsWith('ed') && token.length >= 5) return token.slice(0, -2);

  return token;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/searchEngine.ts src/lib/searchEngine.test.ts
git commit -m "feat(search): conservative stemmer (plurals + -ing/-ed)"
```

---

## Task 3: `levenshtein` — bounded edit distance

**Files:**
- Modify: `src/lib/searchEngine.ts`
- Modify: `src/lib/searchEngine.test.ts`

**Interfaces:**
- Produces: `levenshtein(a: string, b: string, max: number): number` — true distance, or a value `> max` (early-bailed) when it exceeds `max`.

- [ ] **Step 1: Write the failing test** — append to `searchEngine.test.ts`

```ts
import { levenshtein } from './searchEngine.ts';

test('levenshtein computes small edit distances', () => {
  assert.equal(levenshtein('learning', 'learning', 2), 0);
  assert.equal(levenshtein('learning', 'lerning', 2), 1);
  assert.equal(levenshtein('kitten', 'sitting', 3), 3);
});

test('levenshtein early-bails above max', () => {
  assert.ok(levenshtein('abc', 'xyz', 1) > 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: FAIL — `levenshtein` not exported.

- [ ] **Step 3: Implement** — add to `src/lib/searchEngine.ts`

```ts
/** Levenshtein distance with early exit: returns max+1 once the best row exceeds max. */
export function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/searchEngine.ts src/lib/searchEngine.test.ts
git commit -m "feat(search): bounded levenshtein distance"
```

---

## Task 4: `matchTier` type + `buildPageData` (memoized index)

**Files:**
- Modify: `src/lib/types.ts:22-36`
- Modify: `src/lib/searchEngine.ts`
- Modify: `src/lib/searchEngine.test.ts`

**Interfaces:**
- Consumes: existing internal `buildConcatText`, `tokenize`, types `PageTextContent`, `ItemOffset`, `TokenWithPosition`.
- Produces:
  - `SearchResult.matchTier?: number` (0 exact … 3 fuzzy).
  - `interface PageData { page: number; concat: string; offsets: ItemOffset[]; tokens: TokenWithPosition[] }`
  - `buildPageData(pageContents: PageTextContent[]): PageData[]` — memoized by array identity.

- [ ] **Step 1: Add the type field**

In `src/lib/types.ts`, inside `interface SearchResult` (after `spans?` near line 31):

```ts
  /** Match quality tier: 0 exact, 1 accent/case fold, 2 stem, 3 fuzzy. */
  matchTier?: number;
```

- [ ] **Step 2: Write the failing test** — append to `searchEngine.test.ts`

```ts
import { buildPageData } from './searchEngine.ts';
import type { PageTextContent } from './types.ts';

function page(p: number, ...texts: string[]): PageTextContent {
  const items = texts.map((text, itemIndex) => ({
    text, page: p, itemIndex, transform: [], width: 0, height: 0,
  }));
  return { page: p, items, fullText: texts.join(' ') };
}

test('buildPageData concatenates items, tokenizes, and memoizes by identity', () => {
  const pages = [page(1, 'Neural networks', 'learn fast')];
  const a = buildPageData(pages);
  assert.equal(a.length, 1);
  assert.equal(a[0].concat, 'Neural networks learn fast');
  assert.deepEqual(a[0].tokens.map((t) => t.token), ['Neural', 'networks', 'learn', 'fast']);
  // same array reference returns the same cached object
  assert.equal(buildPageData(pages), a);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: FAIL — `buildPageData` not exported.

- [ ] **Step 4: Implement** — add to `src/lib/searchEngine.ts`

```ts
export interface PageData {
  page: number;
  concat: string;
  offsets: ItemOffset[];
  tokens: TokenWithPosition[];
}

const pageDataCache = new WeakMap<PageTextContent[], PageData[]>();

/** Build (and memoize per array identity) the concat text, offsets, and tokens per page. */
export function buildPageData(pageContents: PageTextContent[]): PageData[] {
  const cached = pageDataCache.get(pageContents);
  if (cached) return cached;
  const data: PageData[] = [];
  for (const pg of pageContents) {
    const { text: concat, offsets } = buildConcatText(pg.items, ' ');
    data.push({ page: pg.page, concat, offsets, tokens: tokenize(concat) });
  }
  pageDataCache.set(pageContents, data);
  return data;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/searchEngine.ts src/lib/searchEngine.test.ts
git commit -m "feat(search): matchTier field + memoized page index"
```

---

## Task 5: `matchTokens` — generalized token matcher

**Files:**
- Modify: `src/lib/searchEngine.ts`
- Modify: `src/lib/searchEngine.test.ts`

**Interfaces:**
- Consumes: `PageData` (Task 4), internal `findItemAt`, `findSpannedItems`, type `SearchResult`.
- Produces:
  - `foldKey(token: string, caseSensitive: boolean): string`
  - `matchTokens(pageData: PageData[], queryKeys: string[], keyOf: (token: string) => string): Omit<SearchResult, 'matchTier'>[]` — consecutive-token match where `keyOf(token)` equals the query keys; supports single and multi-word.

- [ ] **Step 1: Write the failing test** — append to `searchEngine.test.ts`

```ts
import { matchTokens, foldKey } from './searchEngine.ts';

test('matchTokens matches via a key transform (identity = exact tokens)', () => {
  const pd = buildPageData([page(1, 'A neural model here', 'two models there')]);
  const keyOf = (t: string) => foldKey(t, false);
  const res = matchTokens(pd, ['model'], keyOf);
  assert.equal(res.length, 1);
  assert.equal(res[0].matchedToken, 'model');
  assert.equal(res[0].page, 1);
});

test('matchTokens supports multi-word phrases', () => {
  const pd = buildPageData([page(1, 'deep neural network design')]);
  const keyOf = (t: string) => foldKey(t, false);
  const res = matchTokens(pd, ['neural', 'network'], keyOf);
  assert.equal(res.length, 1);
  assert.equal(res[0].matchedToken, 'neural network');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: FAIL — `matchTokens`/`foldKey` not exported.

- [ ] **Step 3: Implement** — add to `src/lib/searchEngine.ts`

```ts
/** Folded key for a single token (accent/case-insensitive, accent always folded). */
export function foldKey(token: string, caseSensitive: boolean): string {
  return foldText(token, !caseSensitive).folded;
}

/**
 * Find consecutive runs of tokens whose keyOf(token) equals queryKeys, across all pages.
 * Highlight positions map to the original concat/item text.
 */
export function matchTokens(
  pageData: PageData[],
  queryKeys: string[],
  keyOf: (token: string) => string,
): Omit<SearchResult, 'matchTier'>[] {
  const results: Omit<SearchResult, 'matchTier'>[] = [];
  if (queryKeys.length === 0) return results;

  for (const pd of pageData) {
    const { concat, offsets, tokens } = pd;
    if (tokens.length < queryKeys.length) continue;
    const keys = tokens.map((t) => keyOf(t.token));

    for (let i = 0; i + queryKeys.length <= tokens.length; i++) {
      let ok = true;
      for (let j = 0; j < queryKeys.length; j++) {
        if (keys[i + j] !== queryKeys[j]) { ok = false; break; }
      }
      if (!ok) continue;

      const first = tokens[i];
      const last = tokens[i + queryKeys.length - 1];
      const hit = findItemAt(offsets, first.start);
      if (!hit) continue;
      const localStart = Math.max(0, first.start - hit.start);
      const localEnd = Math.min(hit.item.text.length, last.end - hit.start);
      const spans = findSpannedItems(offsets, first.start, last.end);
      results.push({
        id: `${pd.page}-${hit.item.itemIndex}-${first.start}`,
        page: pd.page,
        matchedToken: concat.slice(first.start, last.end),
        context: hit.item.text,
        itemIndex: hit.item.itemIndex,
        charStart: localStart,
        charEnd: localEnd,
        spans: spans.length > 1 ? spans : undefined,
      });
    }
  }
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/searchEngine.ts src/lib/searchEngine.test.ts
git commit -m "feat(search): generalized token matcher (matchTokens)"
```

---

## Task 6: `mergeTiers` — dedup by position, keep highest tier, sort

**Files:**
- Modify: `src/lib/searchEngine.ts`
- Modify: `src/lib/searchEngine.test.ts`

**Interfaces:**
- Produces: `mergeTiers(tiers: Omit<SearchResult, 'matchTier'>[][]): SearchResult[]` — `tiers[t]` is tier `t`; dedup by `page:itemIndex:charStart` keeping the lowest tier index; sort by `matchTier → page → charStart`.

- [ ] **Step 1: Write the failing test** — append to `searchEngine.test.ts`

```ts
import { mergeTiers } from './searchEngine.ts';

const mk = (page: number, itemIndex: number, charStart: number, token: string) => ({
  id: `${page}-${itemIndex}-${charStart}`, page, itemIndex, charStart,
  charEnd: charStart + token.length, matchedToken: token, context: token,
});

test('mergeTiers keeps the exact (lowest) tier on a position collision', () => {
  const exact = [mk(1, 0, 2, 'model')];
  const stem = [mk(1, 0, 2, 'model'), mk(1, 1, 5, 'models')];
  const out = mergeTiers([exact, [], stem]);
  assert.equal(out.length, 2);
  assert.equal(out[0].matchTier, 0);
  assert.equal(out[0].matchedToken, 'model');
  assert.equal(out[1].matchTier, 2);
  assert.equal(out[1].matchedToken, 'models');
});

test('mergeTiers sorts by tier then document order', () => {
  const exact = [mk(2, 0, 0, 'a')];
  const fold = [mk(1, 0, 0, 'b')];
  const out = mergeTiers([exact, fold]);
  assert.deepEqual(out.map((r) => r.matchedToken), ['a', 'b']); // tier 0 before tier 1
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: FAIL — `mergeTiers` not exported.

- [ ] **Step 3: Implement** — add to `src/lib/searchEngine.ts`

```ts
/** Merge tiered result lists: dedup by position (keep lowest tier), then sort tier→page→pos. */
export function mergeTiers(tiers: Omit<SearchResult, 'matchTier'>[][]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (let tier = 0; tier < tiers.length; tier++) {
    for (const r of tiers[tier]) {
      const key = `${r.page}:${r.itemIndex}:${r.charStart}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...r, matchTier: tier });
    }
  }
  out.sort((a, b) =>
    (a.matchTier! - b.matchTier!) || (a.page - b.page) || (a.charStart - b.charStart)
  );
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/searchEngine.ts src/lib/searchEngine.test.ts
git commit -m "feat(search): mergeTiers dedup + ranking"
```

---

## Task 7: `searchDocument` — orchestrate tiers 0/1/2

**Files:**
- Modify: `src/lib/searchEngine.ts`
- Modify: `src/lib/searchEngine.test.ts`

**Interfaces:**
- Consumes: `exactSearch`, `buildPageData`, `matchTokens`, `foldKey`, `stem`, `mergeTiers`, internal `containsCJK`, `containsSpecialChars`, `tokenize`.
- Produces: `searchDocument(pageContents: PageTextContent[], keyword: string, caseSensitive?: boolean): SearchResult[]`.

- [ ] **Step 1: Write the failing test** — append to `searchEngine.test.ts`

```ts
import { searchDocument } from './searchEngine.ts';

test('searchDocument ranks exact before stemmed variants', () => {
  const pages = [page(1, 'A model here', 'many models too')];
  const out = searchDocument(pages, 'model');
  assert.equal(out[0].matchTier, 0);
  assert.equal(out[0].matchedToken, 'model');
  assert.equal(out[1].matchTier, 2);
  assert.equal(out[1].matchedToken, 'models');
});

test('searchDocument finds accent and ligature variants in tier 1', () => {
  const accent = searchDocument([page(1, 'the café menu')], 'cafe');
  assert.equal(accent[0].matchedToken, 'café');
  assert.equal(accent[0].matchTier, 1);

  const lig = searchDocument([page(1, 'open the ﬁle now')], 'file'); // "ﬁle"
  assert.equal(lig.length, 1);
  assert.equal(lig[0].matchTier, 1);
});

test('searchDocument leaves CJK queries to tier 0', () => {
  const out = searchDocument([page(1, '인공지능은 강력하다')], '인공지능');
  assert.equal(out.length, 1);
  assert.equal(out[0].matchTier, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: FAIL — `searchDocument` not exported.

- [ ] **Step 3: Implement** — add to `src/lib/searchEngine.ts`

```ts
/**
 * Tiered lexical search. Tier 0 = exact (incl. CJK/special/kerning).
 * Tiers 1-2 (accent-fold, stem) run for Latin queries only. Tier 3 (fuzzy) is added in Task 8.
 */
export function searchDocument(
  pageContents: PageTextContent[],
  keyword: string,
  caseSensitive: boolean = false,
): SearchResult[] {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const tier0 = exactSearch(pageContents, trimmed, caseSensitive);

  // CJK / special-char queries: tier 0 only.
  if (containsCJK(trimmed) || containsSpecialChars(trimmed)) {
    return mergeTiers([tier0]);
  }

  const qTokens = tokenize(trimmed).map((t) => t.token);
  if (qTokens.length === 0) return mergeTiers([tier0]);

  const pageData = buildPageData(pageContents);

  const foldQ = qTokens.map((t) => foldKey(t, caseSensitive));
  const tier1 = matchTokens(pageData, foldQ, (tok) => foldKey(tok, caseSensitive));

  const stemQ = foldQ.map((k) => stem(k));
  const tier2 = matchTokens(pageData, stemQ, (tok) => stem(foldKey(tok, caseSensitive)));

  return mergeTiers([tier0, tier1, tier2]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/searchEngine.ts src/lib/searchEngine.test.ts
git commit -m "feat(search): searchDocument orchestrator (tiers 0-2)"
```

---

## Task 8: `fuzzySearch` — typo tolerance (tier 3)

**Files:**
- Modify: `src/lib/searchEngine.ts`
- Modify: `src/lib/searchEngine.test.ts`

**Interfaces:**
- Consumes: `PageData`, `foldKey`, `levenshtein`, internal `findItemAt`.
- Produces: `fuzzySearch(pageData: PageData[], foldedQuery: string, caseSensitive: boolean): Omit<SearchResult, 'matchTier'>[]` — single-token fuzzy match; integrated into `searchDocument` as tier 3 for single-word queries.

- [ ] **Step 1: Write the failing test** — append to `searchEngine.test.ts`

```ts
test('searchDocument tolerates a typo in tier 3', () => {
  const out = searchDocument([page(1, 'supervised learning methods')], 'lerning');
  assert.equal(out.length, 1);
  assert.equal(out[0].matchedToken, 'learning');
  assert.equal(out[0].matchTier, 3);
});

test('searchDocument does not fuzzy-match very short queries', () => {
  const out = searchDocument([page(1, 'the car is red')], 'cat');
  assert.equal(out.length, 0); // 'cat' (len 3) gets no fuzzy tier; no exact/stem either
});

test('searchDocument skips fuzzy for multi-word queries', () => {
  const out = searchDocument([page(1, 'deep neural network')], 'deap neural');
  assert.equal(out.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: FAIL — tier 3 not yet wired (typo returns no results).

- [ ] **Step 3: Implement** — add `fuzzySearch` and wire it into `searchDocument`

Add the function:

```ts
/** Single-token fuzzy match: doc tokens within bounded edit distance of the folded query. */
export function fuzzySearch(
  pageData: PageData[],
  foldedQuery: string,
  caseSensitive: boolean,
): Omit<SearchResult, 'matchTier'>[] {
  const results: Omit<SearchResult, 'matchTier'>[] = [];
  if (foldedQuery.length < 4 || !/[a-z]/i.test(foldedQuery)) return results;
  const maxDist = foldedQuery.length <= 7 ? 1 : 2;

  for (const pd of pageData) {
    for (const t of pd.tokens) {
      const key = foldKey(t.token, caseSensitive);
      if (key === foldedQuery) continue; // exact/fold already covered by lower tiers
      if (Math.abs(key.length - foldedQuery.length) > maxDist) continue;
      if (levenshtein(key, foldedQuery, maxDist) > maxDist) continue;

      const hit = findItemAt(pd.offsets, t.start);
      if (!hit) continue;
      const localStart = Math.max(0, t.start - hit.start);
      const localEnd = Math.min(hit.item.text.length, t.end - hit.start);
      results.push({
        id: `${pd.page}-${hit.item.itemIndex}-${t.start}`,
        page: pd.page,
        matchedToken: t.token,
        context: hit.item.text,
        itemIndex: hit.item.itemIndex,
        charStart: localStart,
        charEnd: localEnd,
      });
    }
  }
  return results;
}
```

Then update `searchDocument`'s return for the Latin path:

```ts
  const tier3 = qTokens.length === 1 ? fuzzySearch(pageData, foldQ[0], caseSensitive) : [];

  return mergeTiers([tier0, tier1, tier2, tier3]);
```

(Replace the existing `return mergeTiers([tier0, tier1, tier2]);` line.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/searchEngine.ts src/lib/searchEngine.test.ts
git commit -m "feat(search): fuzzy typo tier (tier 3)"
```

---

## Task 9: Lock hyphenation + regression coverage

**Files:**
- Modify: `src/lib/searchEngine.test.ts`
- Modify: `src/lib/searchEngine.ts` (only if a test fails)

**Interfaces:**
- Consumes: `searchDocument`.

Rationale: cross-item line-break hyphens (`learn-` + `ing`) and in-item hyphens (`co-operate`) are already handled by `exactSearch`'s space/punctuation-stripped fallback (Tier 0). This task locks that behavior with tests and patches only if a gap appears.

- [ ] **Step 1: Write the regression tests** — append to `searchEngine.test.ts`

```ts
test('searchDocument matches a line-break-hyphenated word across items', () => {
  const out = searchDocument([page(1, 'we learn-', 'ing models')], 'learning');
  assert.ok(out.length >= 1);
  assert.equal(out[0].page, 1);
});

test('searchDocument matches across an in-word hyphen', () => {
  const out = searchDocument([page(1, 'a co-operate clause')], 'cooperate');
  assert.ok(out.length >= 1);
});

test('searchDocument preserves existing exact + multi-term behavior', () => {
  const pages = [page(1, 'Artificial Intelligence', 'and AI systems')];
  const phrase = searchDocument(pages, 'artificial intelligence');
  assert.equal(phrase.length, 1);
  assert.equal(phrase[0].matchTier, 0);

  const acro = searchDocument(pages, 'AI');
  assert.ok(acro.some((r) => r.matchedToken === 'AI'));
});
```

- [ ] **Step 2: Run tests**

Run: `node --test src/lib/searchEngine.test.ts`
Expected: PASS. If the hyphen tests fail, the fallback did not trigger — add a `dehyphenate` pass in `buildConcatText` (join an item ending in `-` with the next when the next starts with a lowercase letter) and re-run; otherwise no code change.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — both `textSelection.test.ts` and `searchEngine.test.ts` green.

- [ ] **Step 4: Commit**

```bash
git add src/lib/searchEngine.test.ts src/lib/searchEngine.ts
git commit -m "test(search): lock hyphenation + exact/multi-term regressions"
```

---

## Task 10: Wire `searchDocument` into the store

**Files:**
- Modify: `src/store/useStore.ts:4` (import), `src/store/useStore.ts:345` (call)

**Interfaces:**
- Consumes: `searchDocument`.

- [ ] **Step 1: Swap the import**

In `src/store/useStore.ts` line 4:

```ts
import { searchDocument } from '@/lib/searchEngine';
```

- [ ] **Step 2: Swap the call**

In `src/store/useStore.ts` (~line 345), replace:

```ts
const results = exactSearch(pageTextContents, st.term, caseSensitive);
```

with:

```ts
const results = searchDocument(pageTextContents, st.term, caseSensitive);
```

- [ ] **Step 3: Type-check the build**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Manual smoke (optional but recommended)**

Run: `npm run dev`, open a PDF, and confirm: a plural query (e.g. "models") surfaces "model"; an accented term matches its unaccented form; a small typo still finds the word; exact hits appear first.

- [ ] **Step 6: Commit**

```bash
git add src/store/useStore.ts
git commit -m "feat(search): use tiered searchDocument in store"
```

---

## Self-Review Notes

- **Spec coverage:** ① stem → Tasks 2,7. ② fuzzy → Tasks 3,8. ③ accent/ligature fold → Tasks 1,7. ④ hyphenation → Task 9 (existing fallback locked). ⑤ tiered ranking → Tasks 6,7. Memoization (spec §4) → Task 4. Tests (spec §6) → every task. Types/store (spec §7) → Tasks 4,10.
- **Latin-only guard** for tiers 1–3 lives in `searchDocument` (CJK/special → tier 0). CJK recall stays via existing `cjkSearch` substring inside `exactSearch`.
- **Out of scope (unchanged):** semantic/embedding search, synonyms, section-weighted ranking, search UI.
