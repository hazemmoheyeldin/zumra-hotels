import { useState, useEffect, useRef, useCallback } from 'react';

interface DraftOptions<T> {
  /** Unique key for this draft in localStorage */
  key: string;
  /** Initial value when no draft exists */
  initialValue: T;
  /** Auto-save interval in ms (default: 3000) */
  interval?: number;
}

interface DraftReturn<T> {
  value: T;
  setValue: (v: T | ((prev: T) => T)) => void;
  /** Call this on successful save to clear the draft */
  clearDraft: () => void;
  /** Whether a draft was found and resumed */
  isDraft: boolean;
}

const DRAFT_PREFIX = 'zumra_draft_';

export function useDraft<T>({ key, initialValue, interval = 3000 }: DraftOptions<T>): DraftReturn<T> {
  const storageKey = DRAFT_PREFIX + key;
  const [isDraft] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== null;
    } catch { return false; }
  });

  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) return JSON.parse(saved) as T;
    } catch { /* ignore parse errors */ }
    return initialValue;
  });

  // Track if value actually changed (to avoid unnecessary writes)
  const valueRef = useRef(value);
  const dirtyRef = useRef(false);

  useEffect(() => {
    valueRef.current = value;
    dirtyRef.current = true;
  }, [value]);

  // Auto-save interval
  useEffect(() => {
    const timer = setInterval(() => {
      if (dirtyRef.current) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(valueRef.current));
          dirtyRef.current = false;
        } catch (e) {
          console.warn('[useDraft] Failed to auto-save draft:', e);
        }
      }
    }, interval);
    return () => clearInterval(timer);
  }, [storageKey, interval]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(valueRef.current));
        } catch { /* ignore */ }
      }
    };
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch { /* ignore */ }
    dirtyRef.current = false;
  }, [storageKey]);

  return { value, setValue, clearDraft, isDraft };
}

/**
 * Checks if a draft exists for the given key.
 * Used to show "Resume previous session?" prompts.
 */
export function hasDraft(key: string): boolean {
  try {
    return localStorage.getItem(DRAFT_PREFIX + key) !== null;
  } catch { return false; }
}

/**
 * Loads a draft value without subscribing to changes.
 */
export function loadDraft<T>(key: string): T | null {
  try {
    const saved = localStorage.getItem(DRAFT_PREFIX + key);
    return saved !== null ? JSON.parse(saved) as T : null;
  } catch { return null; }
}

/**
 * Clears a draft for the given key.
 */
export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch { /* ignore */ }
}
