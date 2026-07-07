import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayKST, secondsUntilMidnightKST } from './kstDate.ts';

// 2026-01-01T15:00:00Z is exactly 2026-01-02 00:00 KST (UTC+9).
const AT_KST_MIDNIGHT = Date.UTC(2026, 0, 1, 15, 0, 0);
// One minute before that KST midnight.
const BEFORE_KST_MIDNIGHT = Date.UTC(2026, 0, 1, 14, 59, 0);

test('todayKST formats as YYYY-MM-DD', () => {
  assert.match(todayKST(AT_KST_MIDNIGHT), /^\d{4}-\d{2}-\d{2}$/);
});

test('todayKST rolls over at KST midnight, not UTC midnight', () => {
  assert.equal(todayKST(BEFORE_KST_MIDNIGHT), '2026-01-01');
  assert.equal(todayKST(AT_KST_MIDNIGHT), '2026-01-02');
});

test('secondsUntilMidnightKST counts down to the next KST midnight', () => {
  assert.equal(secondsUntilMidnightKST(BEFORE_KST_MIDNIGHT), 60);
});

test('secondsUntilMidnightKST stays within a single day', () => {
  const s = secondsUntilMidnightKST(AT_KST_MIDNIGHT);
  assert.ok(s > 0 && s <= 86400, `expected 0 < ${s} <= 86400`);
});
