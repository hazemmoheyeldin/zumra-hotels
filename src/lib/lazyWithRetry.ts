/**
 * Wraps React.lazy() with automatic retry logic for failed dynamic imports.
 * When a deployment replaces old chunk files, browsers requesting the old
 * chunk URLs get a 404 or "Failed to fetch dynamically imported module".
 * This wrapper retries the import and, if it still fails, triggers a hard
 * refresh so the browser loads the new deployment.
 */

import { lazy, ComponentType } from 'react';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function importWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = MAX_RETRIES,
): Promise<{ default: T }> {
  try {
    return await factory();
  } catch (error: any) {
    if (retries <= 0) {
      // All retries exhausted — the chunk is truly gone (new deployment).
      // Force a hard reload to get the new manifest.
      console.warn('[lazyWithRetry] All retries exhausted. Forcing page reload.');
      window.location.reload();
      // Return a never-resolving promise to prevent rendering a broken state.
      return new Promise(() => {});
    }
    console.warn(
      `[lazyWithRetry] Import failed (${error?.message}). Retrying in ${RETRY_DELAY_MS}ms... (${retries} left)`,
    );
    await sleep(RETRY_DELAY_MS);
    return importWithRetry(factory, retries - 1);
  }
}

export default function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() => importWithRetry(factory));
}
