/**
 * Upstash Redis client singleton for Vercel Serverless edge caching.
 * Uses REST API (HTTP) — works both locally and on Vercel without TCP connections.
 * Graceful fallback: if env vars are missing, all operations are no-ops.
 */

import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getClient(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[Redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not configured — cache disabled');
    return null;
  }

  redis = new Redis({ url, token });
  console.log('[Redis] Client initialized');
  return redis;
}

/** Get a cached value by key. Returns null if not found or Redis unavailable. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getClient();
    if (!client) return null;
    const data = await client.get<T>(key);
    // Cache hit logged server-side
    return data ?? null;
  } catch (err) {
    console.warn(`[Redis] GET error for ${key}:`, (err as Error).message);
    return null;
  }
}

/** Set a cached value with TTL in seconds. No-op if Redis unavailable. */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;
    await client.set(key, JSON.parse(JSON.stringify(value)), { ex: ttlSeconds });
    // Cache set logged server-side
  } catch (err) {
    console.warn(`[Redis] SET error for ${key}:`, (err as Error).message);
  }
}

/** Delete keys matching a pattern. No-op if Redis unavailable. */
export async function cacheDel(keys: string[]): Promise<number> {
  try {
    const client = getClient();
    if (!client) return 0;
    if (keys.length === 0) return 0;
    const deleted = await client.del(...keys);
    // Cache del logged server-side
    return deleted;
  } catch (err) {
    console.warn(`[Redis] DEL error:`, (err as Error).message);
    return 0;
  }
}

/** Delete all keys matching a glob pattern using SCAN. */
export async function cacheDelPattern(pattern: string): Promise<number> {
  try {
    const client = getClient();
    if (!client) return 0;

    let cursor = 0;
    let totalDeleted = 0;
    do {
      const [nextCursor, keys] = await client.scan(cursor, { match: pattern, count: 100 });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        totalDeleted += await client.del(...keys);
      }
    } while (cursor !== 0);

    // Pattern del logged server-side
    return totalDeleted;
  } catch (err) {
    console.warn(`[Redis] DEL pattern error for "${pattern}":`, (err as Error).message);
    return 0;
  }
}
