import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Currency = 'SAR' | 'USD' | 'EGP' | 'EUR';

export interface CurrencyContextType {
  activeCurrency: Currency;
  setActiveCurrency: (c: Currency) => void;
  formatCurrency: (amount: number, fromCurrency?: Currency) => string;
  convertAmount: (amount: number, from: Currency, to: Currency) => number;
  fxRates: Record<Currency, number>;
  isLiveRates: boolean;
  ratesTimestamp: string | null;
  ratesSource: string;
  refreshRates: () => void;
}

// Default exchange rates (from SAR as base) - hardcoded fallback
const DEFAULT_FX: Record<Currency, number> = {
  SAR: 1,
  USD: 0.2666,
  EGP: 12.75,
  EUR: 0.245,
};

// localStorage key for persistent cache
const CACHE_KEY = 'zumra_fx_rates_cache';

interface CachedRates {
  rates: Record<string, number>;
  timestamp: string;
  fetchedAt: number;
  source: string;
}

// Load cached rates from localStorage
function loadCache(): CachedRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as CachedRates;
  } catch {}
  return null;
}

// Save rates to localStorage cache
function saveCache(data: CachedRates): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

/** Get the most recent 9 AM Cairo time in ms (UTC+3) */
function getLast9AMCairoMs(): number {
  const now = new Date();
  const cairoNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 3 * 3600000);
  const today9AM = new Date(cairoNow);
  today9AM.setUTCHours(9, 0, 0, 0);
  if (cairoNow.getTime() < today9AM.getTime()) {
    today9AM.setUTCDate(today9AM.getUTCDate() - 1);
  }
  return today9AM.getTime() - 3 * 3600000 - now.getTimezoneOffset() * 60000;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [activeCurrency, setActiveCurrency] = useState<Currency>('SAR');
  const [fxRates, setFxRates] = useState<Record<Currency, number>>(() => {
    // Initialize from localStorage cache if available
    const cached = loadCache();
    if (cached?.rates) return cached.rates as Record<Currency, number>;
    return DEFAULT_FX;
  });
  const [isLiveRates, setIsLiveRates] = useState(false);
  const [ratesTimestamp, setRatesTimestamp] = useState<string | null>(null);
  const [ratesSource, setRatesSource] = useState<string>('defaults');

  const fetchRates = async () => {
    const cached = loadCache();
    const lastRefreshTime = getLast9AMCairoMs();

    // Client-side cache: if rates were fetched after today's 9 AM Cairo, use them
    if (cached && cached.fetchedAt >= lastRefreshTime) {
      setFxRates(cached.rates as Record<Currency, number>);
      setRatesTimestamp(cached.timestamp);
      setIsLiveRates(true);
      setRatesSource(`cached (${cached.source})`);
      return;
    }

    // Fetch from serverless function (API key stays server-side)
    try {
      const res = await fetch('/api/rates', { signal: AbortSignal.timeout(15000) });
      
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();

      if (data.rates) {
        const rates = data.rates as Record<Currency, number>;
        setFxRates(rates);
        setRatesTimestamp(data.timestamp || new Date().toISOString().split('T')[0]);
        setIsLiveRates(true);
        setRatesSource(data.source || 'server');

        // Cache in localStorage for offline/fallback
        saveCache({
          rates: data.rates,
          timestamp: data.timestamp || new Date().toISOString(),
          fetchedAt: Date.now(),
          source: data.source || 'api',
        });
        return;
      }
    } catch (err) {
      console.warn('[CurrencyContext] Fetch failed, using fallback:', err);
    }

    // Fallback: use cached rates from localStorage if available
    if (cached?.rates) {
      setFxRates(cached.rates as Record<Currency, number>);
      setRatesTimestamp(cached.timestamp);
      setIsLiveRates(true);
      setRatesSource(`cached-fallback (${cached.source})`);
      return;
    }

    // Last resort: use hardcoded defaults
    setFxRates(DEFAULT_FX);
    setIsLiveRates(false);
    setRatesSource('defaults');
  };

  useEffect(() => {
    fetchRates();
    // Check every 30 minutes if the 9 AM Cairo refresh window has arrived
    const interval = setInterval(fetchRates, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const convertAmount = (amount: number, from: Currency, to: Currency): number => {
    const safeAmount = amount || 0;
    const amountInSAR = safeAmount / fxRates[from];
    return amountInSAR * fxRates[to];
  };

  const formatCurrency = (amount: number, fromCurrency: Currency = 'SAR') => {
    const converted = convertAmount(amount, fromCurrency, activeCurrency);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(converted);
  };

  return (
    <CurrencyContext.Provider value={{ activeCurrency, setActiveCurrency, formatCurrency, convertAmount, fxRates, isLiveRates, ratesTimestamp, ratesSource, refreshRates: fetchRates }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
