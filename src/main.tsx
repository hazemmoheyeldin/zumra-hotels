import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { CurrencyProvider } from './lib/CurrencyContext.tsx';
import { LanguageProvider } from './lib/LanguageContext.tsx';
import './index.css';
import { runFinancialTests } from './lib/financialTests';

// Run financial precision tests in dev mode on startup (results in console)
if (import.meta.env.DEV) {
  runFinancialTests();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <CurrencyProvider>
        <App />
      </CurrencyProvider>
    </LanguageProvider>
  </StrictMode>,
);
