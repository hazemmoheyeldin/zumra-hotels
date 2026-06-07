/**
 * Financial calculation utilities with floating-point safety.
 *
 * JavaScript's IEEE 754 floating-point arithmetic can produce results like:
 *   0.1 + 0.2 = 0.30000000000000004
 *   1.005 * 100 = 100.49999999999999
 *
 * All currency values in this application are stored as numbers with at most
 * 2 decimal places (SAR/EGP). These helpers ensure precision is maintained
 * across accumulations, subtractions, and aggregations.
 */

/**
 * Rounds a number to exactly 2 decimal places.
 * Uses the "multiply-then-round-then-divide" technique which is reliable
 * for values within normal currency ranges (up to ~10^13).
 */
export function round2(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Sums an array of numbers with rounding applied at each step.
 * Prevents floating-point drift from accumulating across large arrays.
 */
export function sumAmounts(values: number[]): number {
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    total = round2(total + values[i]);
  }
  return total;
}

/**
 * Subtracts b from a with rounding to 2 decimal places.
 * safeSubtract(1.00, 0.70) === 0.30  (not 0.30000000000000004)
 */
export function safeSubtract(a: number, b: number): number {
  return round2(a - b);
}

/**
 * Adds a and b with rounding to 2 decimal places.
 * safeAdd(0.10, 0.20) === 0.30  (not 0.30000000000000004)
 */
export function safeAdd(a: number, b: number): number {
  return round2(a + b);
}

/**
 * Multiplies a by b with rounding to 2 decimal places.
 * Useful for percentage calculations (e.g., commission = total * rate / 100).
 */
export function safeMultiply(a: number, b: number): number {
  return round2(a * b);
}

/**
 * Returns the absolute value rounded to 2 decimal places.
 */
export function absAmount(n: number): number {
  return round2(Math.abs(n));
}

/**
 * Checks if two amounts are equal within a tolerance of 0.01 (1 halala/piastre).
 * Use this instead of strict equality (===) when comparing financial totals.
 */
export function amountsEqual(a: number, b: number, tolerance: number = 0.01): boolean {
  return Math.abs(round2(a) - round2(b)) <= tolerance;
}
