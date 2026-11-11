// Money is an integer number of paise everywhere (server, client, DB). Never a float of rupees.
// Multiplication by quantities/percentages is done exactly in BigInt and rounded half away from zero
// (₹0.005 → ₹0.01, -₹0.005 → -₹0.01), which is how bills are rounded by hand.

/** An integer count of paise (1 rupee = 100 paise). */
export type Paise = number;

const RUPEES = /^(-)?(\d{1,3}(?:,\d{2,3})*|\d+)(?:\.(\d{1,2}))?$/;
const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;
const INR = new Intl.NumberFormat("en-IN"); // lakh/crore grouping; given whole rupees as BigInt, so exact

/** Throws unless `p` is a safe integer number of paise. */
export function assertPaise(p: Paise): Paise {
  if (!Number.isSafeInteger(p)) throw new RangeError(`Not a valid paise amount: ${p}`);
  return p;
}

/**
 * Parses what a user types as a rupee amount: "1,23,456.50", "-12.5", "₹ 100", "100.".
 * Rejects more than 2 decimals, letters, exponents and empty input.
 */
export function parseRupees(input: string): Paise {
  const text = input.replace(/₹|\s/g, "").replace(/\.$/, "");
  const m = RUPEES.exec(text);
  if (!m) throw new RangeError(`Not a valid rupee amount: "${input}"`);
  const [, minus, whole, frac = ""] = m;
  const paise = BigInt(whole!.replaceAll(",", "")) * 100n + BigInt(frac.padEnd(2, "0"));
  return toPaise(minus ? -paise : paise);
}

/** 12345650 → "1,23,456.50"; with symbol → "₹1,23,456.50". Negative: "-1,23,456.50". */
export function formatRupees(p: Paise, { symbol = false } = {}): string {
  const abs = BigInt(Math.abs(assertPaise(p)));
  const text = `${INR.format(abs / 100n)}.${String(abs % 100n).padStart(2, "0")}`;
  return `${p < 0 ? "-" : ""}${symbol ? "₹" : ""}${text}`;
}

/** paise × factor (a quantity like 2.345 or "2.345"), rounded half away from zero. */
export function multiply(p: Paise, factor: number | string): Paise {
  const { value, scale } = decimal(factor);
  return toPaise(divRound(BigInt(assertPaise(p)) * value, 10n ** scale));
}

/** `percent`% of paise (e.g. 18 or "2.5"), rounded half away from zero. */
export function percentOf(p: Paise, percent: number | string): Paise {
  const { value, scale } = decimal(percent);
  return toPaise(divRound(BigInt(assertPaise(p)) * value, 100n * 10n ** scale));
}

/** a / b rounded half away from zero. b > 0. */
function divRound(a: bigint, b: bigint): bigint {
  const q = a / b;
  const twiceRem = (a % b) * 2n;
  if (twiceRem >= b) return q + 1n;
  if (-twiceRem >= b) return q - 1n;
  return q;
}

/** An exact decimal: 2.345 → { value: 2345n, scale: 3n }. */
function decimal(x: number | string): { value: bigint; scale: bigint } {
  // String(number) is the shortest exact round-trip form ("2.345"), except tiny/huge values use "1e-7".
  const m = DECIMAL.exec(typeof x === "number" ? String(x) : x.trim());
  if (!m || (typeof x === "number" && !Number.isFinite(x))) throw new RangeError(`Not a valid decimal: ${x}`);
  const [, minus, whole, frac = ""] = m;
  const value = BigInt(whole! + frac);
  return { value: minus ? -value : value, scale: BigInt(frac.length) };
}

function toPaise(p: bigint): Paise {
  const n = Number(p);
  if (!Number.isSafeInteger(n)) throw new RangeError(`Amount out of range: ${p} paise`);
  return n;
}
