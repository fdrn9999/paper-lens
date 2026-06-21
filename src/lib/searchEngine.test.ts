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
