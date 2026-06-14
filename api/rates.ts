/**
 * Serverless function for fetching exchange rates securely.
 * API key is only available server-side (no VITE_ prefix).
 * Caches rates for 24 hours to stay within free tier limits.
 */

// Vercel serverless handler types (avoid external dependency)
interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: any): void;
  setHeader(name: string, value: string): void;
}

// In-memory cache (persists across warm invocations)
let cachedRates: {
  rates: Record<string, number>;
  timestamp: string;
  fetchedAt: number;
} | null = null;

// Cache duration: refresh once per day at 9 AM Cairo time
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

// Egypt UTC offset: +2 (EET winter) or +3 (EEST summer, April-October)
// We approximate with +3 for most of the year
const EGYPT_UTC_OFFSET = 3;

/** Get the most recent 9 AM Cairo time in UTC milliseconds */
function getLast9AMCairoMs(): number {
  const now = new Date();
  // Current time in Cairo timezone
  const cairoNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + EGYPT_UTC_OFFSET * 3600000);
  // Today's 9 AM in Cairo
  const today9AM = new Date(cairoNow);
  today9AM.setUTCHours(9, 0, 0, 0);
  // If it's before 9 AM Cairo today, use yesterday's 9 AM
  if (cairoNow.getTime() < today9AM.getTime()) {
    today9AM.setUTCDate(today9AM.getUTCDate() - 1);
  }
  // Convert back to UTC
  return today9AM.getTime() - EGYPT_UTC_OFFSET * 3600000 - now.getTimezoneOffset() * 60000;
}

function getEgyptNow(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + EGYPT_UTC_OFFSET * 3600000);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.EXCHANGE_RATE_API_KEY;

  if (!apiKey) {
    console.error('[rates] EXCHANGE_RATE_API_KEY not configured');
    return res.status(503).json({
      error: 'API key not configured',
      cached: cachedRates ? cachedRates.rates : null,
    });
  }

  const now = Date.now();
  const lastRefreshTime = getLast9AMCairoMs();

  // Return cached rates if they were fetched after the last 9 AM Cairo refresh
  if (cachedRates && cachedRates.fetchedAt >= lastRefreshTime) {
    console.log('[rates] Returning cached rates (fresh since 9 AM Cairo)');
    return res.status(200).json({
      source: 'cached',
      rates: cachedRates.rates,
      timestamp: cachedRates.timestamp,
      cachedAt: new Date(cachedRates.fetchedAt).toISOString(),
      nextRefresh: new Date(lastRefreshTime + 24 * 3600000).toISOString(),
    });
  }

  // Fetch fresh rates from ExchangeRate-API
  try {
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/SAR`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      console.error(`[rates] API returned ${response.status}`);
      // Return cached rates as fallback
      if (cachedRates) {
        return res.status(200).json({
          source: 'fallback-cache',
          rates: cachedRates.rates,
          timestamp: cachedRates.timestamp,
          warning: 'Using cached rates due to API error',
        });
      }
      return res.status(502).json({ error: 'Failed to fetch rates' });
    }

    const data = await response.json() as { result?: string; conversion_rates?: Record<string, number>; time_last_update_utc?: string };

    if (data.result !== 'success' || !data.conversion_rates) {
      console.error('[rates] Unexpected API response:', data);
      if (cachedRates) {
        return res.status(200).json({
          source: 'fallback-cache',
          rates: cachedRates.rates,
          timestamp: cachedRates.timestamp,
          warning: 'Using cached rates due to unexpected API response',
        });
      }
      return res.status(502).json({ error: 'Invalid API response' });
    }

    // Extract needed rates (SAR is base, so SAR=1)
    const rates: Record<string, number> = {
      SAR: 1,
      USD: data.conversion_rates.USD,
      EGP: data.conversion_rates.EGP,
      EUR: data.conversion_rates.EUR,
      GBP: data.conversion_rates.GBP,
      AED: data.conversion_rates.AED,
    };

    // Update cache
    cachedRates = {
      rates,
      timestamp: data.time_last_update_utc || new Date().toISOString(),
      fetchedAt: now,
    };

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

    console.log(`[rates] Fetched fresh rates at ${getEgyptNow().toISOString()}`);
    return res.status(200).json({
      source: 'ExchangeRate-API',
      rates,
      timestamp: data.time_last_update_utc,
      fetchedAt: new Date(now).toISOString(),
      nextRefresh: new Date(lastRefreshTime + 24 * 3600000).toISOString(),
    });
  } catch (err: any) {
    console.error('[rates] Fetch error:', err?.message);
    // Return cached rates as fallback
    if (cachedRates) {
      return res.status(200).json({
        source: 'fallback-cache',
        rates: cachedRates.rates,
        timestamp: cachedRates.timestamp,
        warning: 'Using cached rates due to network error',
      });
    }
    return res.status(502).json({ error: 'Network error fetching rates' });
  }
}
