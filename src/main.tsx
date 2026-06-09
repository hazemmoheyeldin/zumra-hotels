import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { CurrencyProvider } from './lib/CurrencyContext.tsx';
import { LanguageProvider } from './lib/LanguageContext.tsx';
import GlobalErrorBoundary from './components/GlobalErrorBoundary.tsx';
import './index.css';
import { runFinancialTests } from './lib/financialTests';

// Run financial precision tests in dev mode on startup (results in console)
if (import.meta.env.DEV) {
  runFinancialTests();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <LanguageProvider>
        <CurrencyProvider>
          <App />
        </CurrencyProvider>
      </LanguageProvider>
    </GlobalErrorBoundary>
  </StrictMode>,
);
