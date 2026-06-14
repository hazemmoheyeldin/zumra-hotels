/**
 * Allotment Availability API
 * 
 * Returns allotment data (room allocation per date) for a given hotel/supplier/date range.
 * TTL: 5 minutes (300 seconds) for dynamic inventory.
 * 
 * GET /api/inventory/allotments?hotelId=X&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&supplierId=Y
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cacheGet, cacheSet } from '../_lib/redis';
import { getFirestoreAdmin } from '../_lib/admin';
import type { AllotmentAvailability } from '../_lib/types';

const TTL_SECONDS = 300; // 5 minutes for dynamic inventory

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { hotelId, supplierId, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

  if (!hotelId || !dateFrom || !dateTo) {
    return res.status(400).json({ error: 'Missing required params: hotelId, dateFrom, dateTo' });
  }

  // Build cache key
  const cacheKey = `allot:${hotelId}:${supplierId || '*'}:${dateFrom}:${dateTo}`;

  // 1. Check Redis cache
  const cached = await cacheGet<{ data: AllotmentAvailability[]; cachedAt: string }>(cacheKey);
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
    if (supplierId) {
      query = query.where('supplierId', '==', supplierId);
    }

    const snapshot = await query.get();
    const allotments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Generate date range
    const dates: string[] = [];
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    // Build allotment availability results
    const results: AllotmentAvailability[] = allotments.map((al: any) => {
      const dailyAvailability: Record<string, { total: number; booked: number; available: number }> = {};

      dates.forEach(date => {
        const dayData = al.dailyAvailability?.[date];
        const total = dayData?.total ?? al.totalRooms ?? 0;
        const booked = dayData?.booked ?? 0;
        dailyAvailability[date] = {
          total,
          booked,
          available: Math.max(0, total - booked),
        };
      });

      return {
        hotelId: al.hotelId,
        supplierId: al.supplierId,
        roomType: al.roomType,
        dailyAvailability,
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
    console.error('[inventory/allotments] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch allotments', detail: err.message });
  }
}
