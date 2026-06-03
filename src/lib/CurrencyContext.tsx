import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Currency = 'SAR' | 'USD' | 'EGP' | 'EUR';

export interface CurrencyContextType {
  activeCurrency: Currency;
  setActiveCurrency: (c: Currency) => void;
  formatCurrency: (amount: number, fromCurrency?: Currency) => string;
}

// Fixed exchange rates (from SAR as base, e.g. 1 SAR = x USD)
const FX_RATES: Record<Currency, number> = {
  SAR: 1,
  USD: 0.2666, // 1 SAR = 0.2666 USD
  EGP: 12.75,  // 1 SAR = 12.75 EGP
  EUR: 0.245,  // 1 SAR = 0.245 EUR
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [activeCurrency, setActiveCurrency] = useState<Currency>('SAR');

  const formatCurrency = (amount: number, fromCurrency: Currency = 'SAR') => {
    // 1. Convert to SAR first
    const safeAmount = amount || 0;
    const amountInSAR = safeAmount / FX_RATES[fromCurrency];
    // 2. Convert to active currency
    const amountInActive = amountInSAR * FX_RATES[activeCurrency];
    
    // Format
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amountInActive);
  };

  return (
    <CurrencyContext.Provider value={{ activeCurrency, setActiveCurrency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
