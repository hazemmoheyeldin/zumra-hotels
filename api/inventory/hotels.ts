/**
 * Static Hotel Details Lookup API
 * 
 * Returns hotel metadata (name, location, room types, etc.).
 * TTL: 24 hours (86400 seconds) for static data.
 * 
 * GET /api/inventory/hotels              — returns all hotels
 * GET /api/inventory/hotels?hotelId=X    — returns single hotel
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cacheGet, cacheSet } from '../_lib/redis';
import { getFirestoreAdmin } from '../_lib/admin';

const TTL_SECONDS = 86400; // 24 hours for static data

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { hotelId } = req.query as Record<string, string | undefined>;
  const cacheKey = hotelId ? `hotel:${hotelId}` : 'hotels:all';

  // 1. Check Redis cache
  const cached = await cacheGet<{ data: any; cachedAt: string }>(cacheKey);
  if (cached) {
    return res.status(200).json({
      data: cached.data,
      meta: { cachedAt: cached.cachedAt, ttl: TTL_SECONDS, source: 'cache' },
    });
  }

  // 2. Cache miss — query Firestore
  try {
    const db = getFirestoreAdmin();

    let data: any;
    if (hotelId) {
      const doc = await db.collection('hotels').doc(hotelId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: `Hotel ${hotelId} not found` });
      }
      data = { id: doc.id, ...doc.data() };
    } else {
      const snapshot = await db.collection('hotels').get();
      data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // 3. Cache the result
    const cachedAt = new Date().toISOString();
    await cacheSet(cacheKey, { data, cachedAt }, TTL_SECONDS);

    return res.status(200).json({
      data,
      meta: { cachedAt, ttl: TTL_SECONDS, source: 'firestore' },
    });
  } catch (err: any) {
    console.error('[inventory/hotels] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch hotels', detail: err.message });
  }
}
