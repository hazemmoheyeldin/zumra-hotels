/**
 * Cache Invalidation API Endpoint
 *
 * Invalidates (deletes) Redis cache keys or patterns.
 * Protected by a shared secret token passed via X-Invalidate-Token header.
 *
 * POST /api/cache/invalidate
 * Body: { "keys": ["exact:key1", "exact:key2"], "patterns": ["avail:hotelId:*", "allot:hotelId:*"] }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cacheDel, cacheDelPattern } from '../_lib/redis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Invalidate-Token');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Validate the invalidation token
  const expectedToken = process.env.CACHE_INVALIDATE_TOKEN;
  const providedToken = req.headers['x-invalidate-token'];

  if (expectedToken && providedToken !== expectedToken) {
    return res.status(403).json({ error: 'Invalid invalidation token' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { keys = [], patterns = [] } = body as { keys?: string[]; patterns?: string[] };

  let totalDeleted = 0;

  // Delete exact keys
  if (keys.length > 0) {
    totalDeleted += await cacheDel(keys);
  }

  // Delete by pattern using SCAN
  for (const pattern of patterns) {
    totalDeleted += await cacheDelPattern(pattern);
  }

  return res.status(200).json({
    deleted: totalDeleted,
    keys,
    patterns,
  });
}
