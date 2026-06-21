import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldText, stem, levenshtein } from './searchEngine.ts';

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

test('levenshtein computes small edit distances', () => {
  assert.equal(levenshtein('learning', 'learning', 2), 0);
  assert.equal(levenshtein('learning', 'lerning', 2), 1);
  assert.equal(levenshtein('kitten', 'sitting', 3), 3);
});

test('levenshtein early-bails above max', () => {
  assert.ok(levenshtein('abc', 'xyz', 1) > 1);
});

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
