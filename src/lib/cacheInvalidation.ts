/**
 * Client-side cache invalidation helper.
 * Sends fire-and-forget requests to the /api/cache/invalidate endpoint
 * to clear Redis cache keys when allotments or reservations change.
 * 
 * Silent failure: errors are logged but never block the calling code.
 */

/**
 * Invalidate specific Redis cache keys and/or glob patterns.
 * Fire-and-forget — does not await or throw.
 */
export function invalidateCache(options: { keys?: string[]; patterns?: string[] }): void {
  // Fire-and-forget: no await, no error blocking
  fetch('/api/cache/invalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keys: options.keys || [],
      patterns: options.patterns || [],
    }),
  }).catch(err => {
    // Silent failure — cache invalidation is best-effort
    console.warn('[Cache Invalidation] Failed:', err?.message);
  });
}

/**
 * Invalidate all availability and allotment cache keys for a specific hotel.
 * Called when allotments are saved/deleted or reservations affect availability.
 */
export function invalidateHotelCache(hotelId: string): void {
  invalidateCache({
    patterns: [
      `avail:${hotelId}:*`,
      `allot:${hotelId}:*`,
    ],
  });
}

/**
 * Invalidate the static hotels cache (all hotels list).
 * Called when hotel data changes (rare — static data has 24h TTL).
 */
export function invalidateHotelsListCache(): void {
  invalidateCache({
    keys: ['hotels:all'],
  });
}
