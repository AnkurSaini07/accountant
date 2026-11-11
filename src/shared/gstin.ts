// GSTIN and PAN validation.
// GSTIN: 2-digit state code + 10-char PAN + entity number + (usually "Z") + check character.
// The check character is the GSTN mod-36 checksum over the first 14 characters.
import { type State, stateByCode } from "./states.ts";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN = /^(\d{2})([A-Z]{5}\d{4}[A-Z])([1-9A-Z])([0-9A-Z])([0-9A-Z])$/;
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;

export type Gstin = { gstin: string; state: State; pan: string };

/** Upper-cases and strips spaces, so "06 aabcs 1234 f1z5" can be checked. */
export const normalizeGstin = (input: string) => input.replace(/\s/g, "").toUpperCase();

/** The check character for the first 14 characters of a GSTIN. */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = ALPHABET.indexOf(first14[i]!);
    if (value < 0) throw new RangeError(`Invalid GSTIN character "${first14[i]}"`);
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return ALPHABET[(36 - (sum % 36)) % 36]!;
}

/**
 * Validates a GSTIN and returns its parts, or throws a RangeError whose message can be shown to the user.
 * Lowercase and spaces are accepted; the returned `gstin` is normalized.
 */
export function parseGstin(input: string): Gstin {
  const gstin = normalizeGstin(input);
  const m = GSTIN.exec(gstin);
  if (!m) throw new RangeError("GSTIN must be 15 characters: 2-digit state code, 10-character PAN, then 3 more characters.");
  const state = stateByCode(m[1]!);
  if (!state) throw new RangeError(`GSTIN starts with ${m[1]}, which is not an Indian state code.`);
  if (gstinCheckChar(gstin) !== m[5]) throw new RangeError("GSTIN check digit doesn't match. Please check for a typo.");
  return { gstin, state, pan: m[2]! };
}

/** PAN format: 5 letters, 4 digits, 1 letter (case-insensitive, spaces ignored). */
export function isValidPan(input: string): boolean {
  return PAN.test(input.replace(/\s/g, "").toUpperCase());
}
