import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getClientIp } from './clientIp.ts';

function reqWith(headers: Record<string, string>): Request {
  return new Request('https://example.com/', { headers });
}

test('uses the rightmost x-forwarded-for IP (trusted proxy)', () => {
  assert.equal(getClientIp(reqWith({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' })), '3.3.3.3');
});

test('handles a single IP', () => {
  assert.equal(getClientIp(reqWith({ 'x-forwarded-for': '9.9.9.9' })), '9.9.9.9');
});

test('trims whitespace and ignores empty segments', () => {
  assert.equal(getClientIp(reqWith({ 'x-forwarded-for': ' 1.1.1.1 ,  , 4.4.4.4 ' })), '4.4.4.4');
});

test('returns "unknown" when x-forwarded-for is absent', () => {
  assert.equal(getClientIp(reqWith({})), 'unknown');
});

test('does not fall back to spoofable x-real-ip', () => {
  assert.equal(getClientIp(reqWith({ 'x-real-ip': '6.6.6.6' })), 'unknown');
});
