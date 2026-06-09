import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    // Log error to localStorage for debugging
    try {
      const logKey = 'zumra_error_log';
      const existing = JSON.parse(localStorage.getItem(logKey) || '[]');
      existing.push({
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack?.substring(0, 500),
        componentStack: errorInfo.componentStack?.toString().substring(0, 500),
      });
      // Keep only last 50 entries
      localStorage.setItem(logKey, JSON.stringify(existing.slice(-50)));
    } catch { /* ignore logging errors */ }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 max-w-md w-full">
            <div className="text-rose-500 text-4xl mb-3">!</div>
            <h3 className="text-lg font-bold text-rose-800 mb-2">Something went wrong</h3>
            <p className="text-sm text-rose-600 mb-1">
              {this.props.fallbackLabel || 'This section encountered an error.'}
            </p>
            <p className="text-xs text-rose-400 mb-4 font-mono break-all">
              {this.state.error?.message}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-sm transition cursor-pointer min-h-[44px]"
              >
                Retry
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm transition cursor-pointer min-h-[44px]"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
