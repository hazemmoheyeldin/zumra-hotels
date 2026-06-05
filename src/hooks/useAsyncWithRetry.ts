import { useState, useCallback, useRef } from 'react';

interface AsyncState {
  loading: boolean;
  error: string | null;
  retriesLeft: number;
}

/**
 * Wraps an async function with timeout, loading state, error handling,
 * and automatic retry logic. Prevents hanging on network failures.
 */
export function useAsyncWithRetry<T extends (...args: any[]) => Promise<any>>(
  asyncFn: T,
  options?: { timeoutMs?: number; maxRetries?: number }
) {
  const timeoutMs = options?.timeoutMs ?? 10000;
  const maxRetries = options?.maxRetries ?? 3;

  const [state, setState] = useState<AsyncState>({
    loading: false,
    error: null,
    retriesLeft: maxRetries,
  });

  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (...args: Parameters<T>): Promise<ReturnType<T> | null> => {
    // Abort previous call if still running
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setState({ loading: true, error: null, retriesLeft: maxRetries });

    for (let attempt = maxRetries; attempt >= 0; attempt--) {
      try {
        const result = await Promise.race([
          asyncFn(...args),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
          ),
        ]);
        setState({ loading: false, error: null, retriesLeft: 0 });
        return result as ReturnType<T>;
      } catch (err: any) {
        if (attempt === 0) {
          setState({ loading: false, error: err?.message || 'Operation failed', retriesLeft: 0 });
          return null;
        }
        // Wait briefly before retry
        await new Promise(r => setTimeout(r, 500));
        setState(prev => ({ ...prev, retriesLeft: attempt - 1 }));
      }
    }
    return null;
  }, [asyncFn, timeoutMs, maxRetries]);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setState({ loading: false, error: null, retriesLeft: maxRetries });
  }, [maxRetries]);

  return { ...state, execute, reset };
}
