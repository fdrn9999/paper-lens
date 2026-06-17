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

test('expandToWord at text.length selects the last word', () => {
  assert.deepEqual(expandToWord('hello world', 11), { start: 6, end: 11 });
});

test('findArrayIndex maps a sparse itemIndex to its array position', () => {
  const sparse: SelItem[] = [
    { itemIndex: 10, text: 'a', y: 0, height: 10 },
    { itemIndex: 20, text: 'b', y: 10, height: 10 },
  ];
  assert.equal(findArrayIndex(sparse, 20), 1);
  assert.equal(findArrayIndex(sparse, 10), 0);
});
