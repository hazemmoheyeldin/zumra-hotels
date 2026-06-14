/**
 * Shared types for the Vercel Serverless API edge caching layer.
 */

/** Query parameters for hotel availability search */
export interface AvailabilitySearchQuery {
  hotelId: string;
  checkIn: string;  // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  roomType?: string;
}

/** Result for a single date's availability */
export interface DateAvailability {
  date: string;
  total: number;
  booked: number;
  available: number;
}

/** Availability search result */
export interface AvailabilityResult {
  hotelId: string;
  hotelName: string;
  roomType: string;
  supplierId: string;
  dates: DateAvailability[];
}

/** Query parameters for allotment availability */
export interface AllotmentQuery {
  hotelId: string;
  supplierId?: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
}

/** Cached allotment data */
export interface AllotmentAvailability {
  hotelId: string;
  supplierId: string;
  roomType: string;
  dailyAvailability: Record<string, { total: number; booked: number; available: number }>;
}

/** Metadata attached to every cached API response */
export interface CacheMeta {
  cachedAt: string;       // ISO timestamp
  ttl: number;            // TTL in seconds
  source: 'cache' | 'firestore';
}

/** Standard API response wrapper */
export interface ApiResponse<T> {
  data: T;
  meta: CacheMeta;
}

/** Cache invalidation request body */
export interface InvalidateRequest {
  keys?: string[];
  patterns?: string[];
}

/** Cache invalidation response */
export interface InvalidateResponse {
  deleted: number;
  keys: string[];
  patterns: string[];
}
