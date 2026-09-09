import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { env } from '../config/env.js';
import { badRequest } from './errors.js';

/**
 * Normalises any user input ("98765 43210", "+91 98765-43210") to E.164: +919876543210.
 * Always store and compare phone numbers in E.164 — never as typed.
 */
export function normalisePhone(input: string): string {
  const parsed = parsePhoneNumberFromString(input.trim(), env.DEFAULT_COUNTRY as never);
  if (!parsed || !parsed.isValid()) {
    throw badRequest('INVALID_PHONE', 'Please enter a valid mobile number.');
  }
  if (parsed.getType() === 'FIXED_LINE') {
    throw badRequest('INVALID_PHONE', 'Please enter a mobile number, not a landline.');
  }
  return parsed.number;
}

/** +919876543210 -> +91******3210, for safe logging and UI echo. */
export function maskPhone(e164: string): string {
  return e164.length < 6 ? '***' : e164.slice(0, 3) + '*'.repeat(e164.length - 7) + e164.slice(-4);
}
