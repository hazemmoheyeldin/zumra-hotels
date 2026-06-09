/**
 * Global Error Boundary that specifically detects "Failed to fetch dynamically
 * imported module" errors (stale chunks after a deployment) and shows a
 * user-friendly "Update Available" screen with a refresh button.
 *
 * For any other error it shows a generic fallback with a refresh option.
 */

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /could not resolve module/i,
  /loading chunk [\w-]+ failed/i,
];

function isChunkLoadError(error: any): boolean {
  const msg = error?.message || error?.toString?.() || '';
  return CHUNK_ERROR_PATTERNS.some((p) => p.test(msg));
}

export default class GlobalErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: any, info: React.ErrorInfo) {
    console.error('[GlobalErrorBoundary]', error, info);
    // Auto-reload on chunk errors after a short delay
    if (isChunkLoadError(error)) {
      setTimeout(() => window.location.reload(), 2000);
    }
  }

  handleRefresh = () => {
    // Hard reload bypasses cache
    window.location.href = window.location.href + '?t=' + Date.now();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.state.isChunkError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', fontFamily: 'system-ui, -apple-system, sans-serif',
          zIndex: 9999999, padding: 24,
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 420, width: '100%',
            textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Update Available</h2>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 24px' }}>
              A new version of the platform has been deployed. Your browser needs to refresh to load the latest files.
            </p>
            <button
              onClick={this.handleRefresh}
              style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12,
                padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                transition: 'transform 0.15s', width: '100%',
              }}
              onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Refresh Now
            </button>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 16, marginBottom: 0 }}>
              Auto-refreshing in a few seconds...
            </p>
          </div>
        </div>
      );
    }

    // Generic error fallback
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', zIndex: 9999999, padding: 24,
      }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 420, width: '100%',
          textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 24px' }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={this.handleRefresh}
            style={{
              background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12,
              padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%',
            }}
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
}
