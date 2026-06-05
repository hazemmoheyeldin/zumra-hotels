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
  refreshRates: () => void;
}

// Default exchange rates (from SAR as base)
const DEFAULT_FX: Record<Currency, number> = {
  SAR: 1,
  USD: 0.2666,
  EGP: 12.75,
  EUR: 0.245,
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [activeCurrency, setActiveCurrency] = useState<Currency>('SAR');
  const [fxRates, setFxRates] = useState<Record<Currency, number>>(DEFAULT_FX);
  const [isLiveRates, setIsLiveRates] = useState(false);
  const [ratesTimestamp, setRatesTimestamp] = useState<string | null>(null);

  const fetchLiveRates = async () => {
    // Try multiple free APIs for reliability and accuracy
    const fetchers = [
      // Frankfurter.app - ECB-backed, very accurate
      async () => {
        const res = await fetch('https://api.frankfurter.app/latest?from=SAR');
        const data = await res.json();
        if (data?.rates && data.rates.USD && data.rates.EGP && data.rates.EUR) {
          return {
            rates: {
              SAR: 1,
              USD: data.rates.USD,
              EGP: data.rates.EGP,
              EUR: data.rates.EUR,
            },
            timestamp: data.date || new Date().toISOString().split('T')[0],
          };
        }
        throw new Error('Frankfurter: incomplete data');
      },
      // ExchangeRate-API fallback
      async () => {
        const res = await fetch('https://open.er-api.com/v6/latest/SAR');
        const data = await res.json();
        if (data?.rates && data.rates.USD && data.rates.EGP && data.rates.EUR) {
          return {
            rates: {
              SAR: 1,
              USD: data.rates.USD,
              EGP: data.rates.EGP,
              EUR: data.rates.EUR,
            },
            timestamp: data.time_last_update_utc || new Date().toISOString(),
          };
        }
        throw new Error('ER-API: incomplete data');
      },
    ];

    for (const fetcher of fetchers) {
      try {
        const result = await fetcher();
        setFxRates(result.rates as Record<Currency, number>);
        setRatesTimestamp(result.timestamp);
        setIsLiveRates(true);
        return;
      } catch {
        // Try next fallback
      }
    }
    // All APIs failed, keep defaults
    setIsLiveRates(false);
  };

  useEffect(() => {
    fetchLiveRates();
    // Re-fetch every 6 hours
    const interval = setInterval(fetchLiveRates, 6 * 60 * 60 * 1000);
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
    <CurrencyContext.Provider value={{ activeCurrency, setActiveCurrency, formatCurrency, convertAmount, fxRates, isLiveRates, ratesTimestamp, refreshRates: fetchLiveRates }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
