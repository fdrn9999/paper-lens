/**
 * Extracts client IP from request headers.
 * Uses the rightmost IP in x-forwarded-for (appended by the nearest trusted proxy, e.g. Vercel).
 * The client-controllable x-real-ip is NOT used as a fallback — trusting it would let an attacker
 * mint a fresh per-IP quota / rate-limit bucket per request by spoofing the header.
 *
 * B-08 policy: when x-forwarded-for is absent we return 'unknown', so all such clients share a
 * single quota/rate-limit bucket. On Vercel (the deployment target) x-forwarded-for is always
 * present, so this only affects proxy-less/self-hosted setups. We deliberately keep the shared
 * bucket rather than trusting a spoofable header; the global daily budget still caps total cost.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim()).filter(Boolean);
    if (ips.length > 0) return ips[ips.length - 1];
  }
  return 'unknown';
}
