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

// Cache validity: 5 hours (extended caching for performance)
const CACHE_VALIDITY_MS = 5 * 60 * 60 * 1000; // 5 hours

function isCacheFresh(cached: CachedRates | null): boolean {
  if (!cached) return false;
  return (Date.now() - cached.fetchedAt) < CACHE_VALIDITY_MS;
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

    // Extended cache: if rates were fetched within 5 hours, use them
    if (isCacheFresh(cached)) {
      setFxRates(cached!.rates as Record<Currency, number>);
      setRatesTimestamp(cached!.timestamp);
      setIsLiveRates(true);
      setRatesSource(`cached (${cached!.source})`);
      return;
    }

    // Fetch from serverless function with timeout and fallback
    try {
      const res = await fetch('/api/rates', { signal: AbortSignal.timeout(10000) });
      
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
    // Check every 5 hours if cache has expired
    const interval = setInterval(fetchRates, 5 * 60 * 60 * 1000);
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
