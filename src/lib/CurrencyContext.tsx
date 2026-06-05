import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Currency = 'SAR' | 'USD' | 'EGP' | 'EUR';

export interface CurrencyContextType {
  activeCurrency: Currency;
  setActiveCurrency: (c: Currency) => void;
  formatCurrency: (amount: number, fromCurrency?: Currency) => string;
  convertAmount: (amount: number, from: Currency, to: Currency) => number;
  fxRates: Record<Currency, number>;
  isLiveRates: boolean;
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

  const fetchLiveRates = async () => {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/SAR');
      const data = await res.json();
      if (data?.rates) {
        setFxRates({
          SAR: 1,
          USD: data.rates.USD || DEFAULT_FX.USD,
          EGP: data.rates.EGP || DEFAULT_FX.EGP,
          EUR: data.rates.EUR || DEFAULT_FX.EUR,
        });
        setIsLiveRates(true);
      }
    } catch {
      // Silently fall back to default rates
    }
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
    <CurrencyContext.Provider value={{ activeCurrency, setActiveCurrency, formatCurrency, convertAmount, fxRates, isLiveRates, refreshRates: fetchLiveRates }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
