/**
 * Input Validation Utilities for Zumra Hotels RMS
 * Strict validation for all data entry forms to prevent empty, duplicate, or incorrectly formatted records.
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Check if a string is non-empty after trimming */
export function required(value: any, fieldName: string): ValidationError | null {
  if (value === null || value === undefined) return { field: fieldName, message: `${fieldName} is required` };
  if (typeof value === 'string' && value.trim() === '') return { field: fieldName, message: `${fieldName} is required` };
  return null;
}

/** Check minimum length */
export function minLength(value: string, min: number, fieldName: string): ValidationError | null {
  if (value && value.trim().length < min) return { field: fieldName, message: `${fieldName} must be at least ${min} characters` };
  return null;
}

/** Check maximum length */
export function maxLength(value: string, max: number, fieldName: string): ValidationError | null {
  if (value && value.trim().length > max) return { field: fieldName, message: `${fieldName} must be at most ${max} characters` };
  return null;
}

/** Validate email format */
export function validEmail(value: string, fieldName: string = 'Email'): ValidationError | null {
  if (!value) return null; // Use required() separately if needed
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(value)) return { field: fieldName, message: 'Please enter a valid email address' };
  return null;
}

/** Validate phone number (international format) */
export function validPhone(value: string, fieldName: string = 'Phone'): ValidationError | null {
  if (!value) return null;
  const cleaned = value.replace(/[\s\-\(\)\.]/g, '');
  if (!/^\+?\d{7,15}$/.test(cleaned)) return { field: fieldName, message: 'Please enter a valid phone number' };
  return null;
}

/** Validate date string (YYYY-MM-DD) */
export function validDate(value: string, fieldName: string = 'Date'): ValidationError | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { field: fieldName, message: 'Invalid date format (use YYYY-MM-DD)' };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { field: fieldName, message: 'Invalid date' };
  return null;
}

/** Validate positive number */
export function positiveNumber(value: number | string, fieldName: string): ValidationError | null {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num < 0) return { field: fieldName, message: `${fieldName} must be a positive number` };
  return null;
}

/** Validate number is greater than zero */
export function nonZeroPositive(value: number | string, fieldName: string): ValidationError | null {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num <= 0) return { field: fieldName, message: `${fieldName} must be greater than zero` };
  return null;
}

/** Check for duplicate value in an array */
export function noDuplicate(value: string, existing: string[], fieldName: string, excludeId?: string): ValidationError | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  const found = existing.find(e => e.toLowerCase() === lower);
  if (found) return { field: fieldName, message: `${fieldName} "${value}" already exists` };
  return null;
}

/** Run multiple validators and collect errors */
export function validate(...checks: (ValidationError | null)[]): ValidationResult {
  const errors = checks.filter(Boolean) as ValidationError[];
  return { valid: errors.length === 0, errors };
}

/** Validate a reservation has required fields */
export function validateReservation(data: {
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  hotelId?: string;
  clientId?: string;
  rooms?: any[];
}): ValidationResult {
  return validate(
    required(data.guestName, 'Guest Name'),
    minLength(data.guestName || '', 2, 'Guest Name'),
    required(data.checkIn, 'Check-In Date'),
    required(data.checkOut, 'Check-Out Date'),
    validDate(data.checkIn || '', 'Check-In Date'),
    validDate(data.checkOut || '', 'Check-Out Date'),
    required(data.hotelId, 'Hotel'),
    required(data.clientId, 'Client'),
    data.rooms && data.rooms.length === 0 ? { field: 'rooms', message: 'At least one room is required' } : null,
    data.checkIn && data.checkOut && data.checkIn >= data.checkOut ? { field: 'checkOut', message: 'Check-Out must be after Check-In' } : null,
  );
}

/** Validate an agent (client/supplier) has required fields */
export function validateAgent(data: {
  name?: string;
  country?: string;
  type?: string;
  phone?: string;
}): ValidationResult {
  return validate(
    required(data.name, 'Company/Agent Name'),
    minLength(data.name || '', 2, 'Company/Agent Name'),
    required(data.country, 'Country'),
    required(data.type, 'Type'),
    data.phone ? validPhone(data.phone, 'Phone') : null,
  );
}

/** Validate a transaction has required fields */
export function validateTransaction(data: {
  amount?: number;
  date?: string;
  type?: string;
  fromAccountId?: string;
}): ValidationResult {
  return validate(
    nonZeroPositive(data.amount || 0, 'Amount'),
    required(data.date, 'Date'),
    validDate(data.date || '', 'Date'),
    required(data.type, 'Type'),
    required(data.fromAccountId, 'Account'),
  );
}

/** Validate a hotel has required fields */
export function validateHotel(data: {
  name?: string;
  city?: string;
  country?: string;
}): ValidationResult {
  return validate(
    required(data.name, 'Hotel Name'),
    minLength(data.name || '', 2, 'Hotel Name'),
    required(data.city, 'City'),
    required(data.country, 'Country'),
  );
}

/** Format validation errors as a readable string for toast display */
export function formatErrors(result: ValidationResult): string {
  if (result.valid) return '';
  return result.errors.map(e => e.message).join('\n');
}
