// Quantities are integers in the unit's smallest step (NFR-1): with 3 decimals, 1.250 KGS is 1250.
// Converted as text, never through floating point, so "0.1" stays exactly 100 and not 99.99….

/** "1.25" with 3 decimals → 1250. Throws RangeError for anything that isn't a plain amount in that unit. */
export function parseQty(text: string, decimals: number): number {
  const m = /^(\d+)(?:\.(\d*))?$/.exec(text.replace(/[\s,]/g, ""));
  if (!m || (m[2] ?? "").length > decimals) {
    throw new RangeError(decimals ? `Enter a quantity with at most ${decimals} decimals.` : "Enter a whole number.");
  }
  const n = Number(m[1]! + (m[2] ?? "").padEnd(decimals, "0"));
  if (!Number.isSafeInteger(n)) throw new RangeError("Quantity is too large.");
  return n;
}

/** 1250 with 3 decimals → "1.250"; 12 with 0 → "12". */
export function formatQty(n: number, decimals: number): string {
  if (!decimals) return String(n);
  const s = String(n).padStart(decimals + 1, "0");
  return `${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
}
