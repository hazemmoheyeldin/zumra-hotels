/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Security utilities for Zumra Hotels RMS
 */

/**
 * Sanitize user input by stripping HTML/script tags and dangerous characters
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Sanitize all string fields in an object recursively
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') return sanitizeInput(obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item)) as unknown as T;
  if (obj && typeof obj === 'object') {
    const sanitized = { ...obj };
    for (const key of Object.keys(sanitized)) {
      (sanitized as any)[key] = sanitizeObject((sanitized as any)[key]);
    }
    return sanitized;
  }
  return obj;
}

/**
 * Validate password strength
 * Returns { valid: boolean, errors: string[] }
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  return { valid: errors.length === 0, errors };
}

/**
 * Generate a CSRF-like token for form submissions
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Session timeout tracker
 * Call resetActivity() on user interactions
 * Calls onTimeout() after timeoutMs of inactivity
 */
export class SessionTimeout {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private timeoutMs: number;
  private onTimeout: () => void;

  constructor(timeoutMs: number, onTimeout: () => void) {
    this.timeoutMs = timeoutMs;
    this.onTimeout = onTimeout;
  }

  start() {
    this.reset();
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, this.reset, { passive: true }));
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.removeEventListener(event, this.reset));
  }

  reset = () => {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this.onTimeout, this.timeoutMs);
  };
}
