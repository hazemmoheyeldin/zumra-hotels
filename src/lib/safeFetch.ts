/**
 * Safe Fetch Utility - wraps all external API calls with:
 * - Timeout protection
 * - Retry with exponential backoff
 * - Graceful fallback
 * - Non-intrusive error reporting
 */

interface SafeFetchOptions {
  timeout?: number;     // ms, default 15000
  retries?: number;     // default 2
  retryDelay?: number;  // ms, default 1000
  fallback?: any;       // fallback value on total failure
  onError?: (error: Error) => void;
  label?: string;       // for logging
}

interface SafeFetchResult<T> {
  data: T | null;
  error: string | null;
  isStale: boolean;     // true if using cached/fallback data
}

/** Global API warning state - components can subscribe to show non-intrusive banners */
let apiWarnings: Record<string, { message: string; timestamp: number }> = {};
let warningListeners: Array<(warnings: Record<string, { message: string; timestamp: number }>) => void> = [];

export function getApiWarnings() { return apiWarnings; }
export function onApiWarningChange(listener: (warnings: Record<string, { message: string; timestamp: number }>) => void): () => void {
  warningListeners.push(listener);
  return () => { warningListeners = warningListeners.filter(l => l !== listener); };
}
export function clearApiWarning(key: string) {
  delete apiWarnings[key];
  warningListeners.forEach(l => l({ ...apiWarnings }));
}

function setApiWarning(key: string, message: string) {
  apiWarnings = { ...apiWarnings, [key]: { message, timestamp: Date.now() } };
  warningListeners.forEach(l => l({ ...apiWarnings }));
  // Auto-clear after 30 seconds
  setTimeout(() => clearApiWarning(key), 30000);
}

/**
 * Safe fetch wrapper with timeout, retry, and fallback.
 * Use for all external API calls (Currency, Geoapify, etc.)
 */
export async function safeFetch<T>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const { timeout = 15000, retries = 2, retryDelay = 1000, fallback = null, onError, label = url } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const data = (await res.json()) as T;
      // Clear any previous warning on success
      clearApiWarning(label);
      return { data, error: null, isStale: false };
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') {
        lastError = new Error(`Request timed out after ${timeout}ms`);
      }
      console.warn(`[safeFetch] ${label} attempt ${attempt + 1}/${retries + 1} failed:`, lastError.message);

      if (attempt < retries) {
        await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt)));
      }
    }
  }

  // All attempts failed
  const errorMsg = lastError?.message || 'Unknown error';
  setApiWarning(label, `${label} unavailable: ${errorMsg}`);
  onError?.(lastError || new Error(errorMsg));
  return { data: fallback, error: errorMsg, isStale: true };
}

/**
 * Safe async function wrapper - catches errors and returns fallback.
 * Use for non-fetch async operations that need error resilience.
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  label: string = 'operation'
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    console.warn(`[safeAsync] ${label} failed:`, err?.message);
    setApiWarning(label, `${label} failed: ${err?.message || 'Unknown error'}`);
    return fallback;
  }
}

/**
 * Background task runner - executes heavy operations without blocking UI.
 * Uses requestIdleCallback when available, falls back to setTimeout.
 */
export function runInBackground<T>(fn: () => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const execute = async () => {
      try {
        resolve(await fn());
      } catch (err) {
        reject(err);
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(execute, { timeout: 2000 });
    } else {
      setTimeout(execute, 0);
    }
  });
}
