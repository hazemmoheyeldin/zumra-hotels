/**
 * Hotel Availability Search API
 * 
 * Checks Redis cache first. On miss, queries Firestore via Admin SDK
 * for allotments matching the hotel + room type + date range.
 * TTL: 5 minutes (300 seconds) for dynamic inventory.
 * 
 * GET /api/inventory/search?hotelId=X&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&roomType=Y
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cacheGet, cacheSet } from '../_lib/redis';
import { getFirestoreAdmin } from '../_lib/admin';
import type { AvailabilityResult, DateAvailability } from '../_lib/types';

const TTL_SECONDS = 300; // 5 minutes for dynamic inventory

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { hotelId, checkIn, checkOut, roomType } = req.query as Record<string, string | undefined>;

  if (!hotelId || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Missing required params: hotelId, checkIn, checkOut' });
  }

  // Build cache key
  const cacheKey = `avail:${hotelId}:${roomType || '*'}:${checkIn}:${checkOut}`;

  // 1. Check Redis cache
  const cached = await cacheGet<{ data: AvailabilityResult[]; cachedAt: string }>(cacheKey);
  if (cached) {
    return res.status(200).json({
      data: cached.data,
      meta: { cachedAt: cached.cachedAt, ttl: TTL_SECONDS, source: 'cache' },
    });
  }

  // 2. Cache miss — query Firestore
  try {
    const db = getFirestoreAdmin();
    let query: FirebaseFirestore.Query = db.collection('allotments').where('hotelId', '==', hotelId);
    if (roomType) {
      query = query.where('roomType', '==', roomType);
    }

    const snapshot = await query.get();
    const allotments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Generate date range
    const dates: string[] = [];
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    // Build availability results per allotment
    const results: AvailabilityResult[] = allotments.map((al: any) => {
      const daily: DateAvailability[] = dates.map(date => {
        const dayData = al.dailyAvailability?.[date];
        const total = dayData?.total ?? al.totalRooms ?? 0;
        const booked = dayData?.booked ?? 0;
        return { date, total, booked, available: Math.max(0, total - booked) };
      });

      // Fetch hotel name from hotels collection (cached separately)
      return {
        hotelId: al.hotelId,
        hotelName: '', // Will be resolved by hotels endpoint
        roomType: al.roomType,
        supplierId: al.supplierId,
        dates: daily,
      };
    });

    // 3. Cache the result
    const cachedAt = new Date().toISOString();
    await cacheSet(cacheKey, { data: results, cachedAt }, TTL_SECONDS);

    return res.status(200).json({
      data: results,
      meta: { cachedAt, ttl: TTL_SECONDS, source: 'firestore' },
    });
  } catch (err: any) {
    console.error('[inventory/search] Error:', err.message);
    return res.status(500).json({ error: 'Failed to search availability', detail: err.message });
  }
}
