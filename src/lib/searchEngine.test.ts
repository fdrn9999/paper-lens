import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldText, stem, levenshtein, buildPageData, matchTokens, foldKey, mergeTiers, searchDocument } from './searchEngine.ts';
import type { PageTextContent } from './types.ts';

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

test('stem precision boundary: accepted over-stem, no false core collisions', () => {
  assert.equal(stem('caring'), 'car');                 // accepted over-stem (base ends in e, not restored)
  assert.notEqual(stem('university'), stem('universal')); // must NOT collide
});


test('levenshtein computes small edit distances', () => {
  assert.equal(levenshtein('learning', 'learning', 2), 0);
  assert.equal(levenshtein('learning', 'lerning', 2), 1);
  assert.equal(levenshtein('kitten', 'sitting', 3), 3);
});

test('levenshtein early-bails above max', () => {
  assert.ok(levenshtein('abc', 'xyz', 1) > 1);
});

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
