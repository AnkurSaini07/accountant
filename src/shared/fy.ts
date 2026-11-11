// Indian financial years: 1 April → 31 March. A FY is identified by its start year (2026 = FY 2026-27).
// Business dates are "YYYY-MM-DD" strings (Postgres `date`), never JS Dates, so a server in UTC and a
// browser in IST agree on which day (and FY) it is.

/** Calendar date, "YYYY-MM-DD". */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FY_LABEL = /^(\d{4})-(\d{2})$/;
const IST_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }); // en-CA formats as YYYY-MM-DD

/** Today's date in India, whatever the machine's time zone. */
export function todayInIndia(now = new Date()): IsoDate {
  return IST_DATE.format(now);
}

/** Start year of the FY containing `date`: 2026-03-31 → 2025, 2026-04-01 → 2026. */
export function fyOf(date: IsoDate): number {
  const m = ISO_DATE.exec(date);
  const [y, mo, d] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [];
  // Round-trip through Date.UTC rejects impossible dates like 2026-02-29 or 2026-13-01.
  if (y === undefined || new Date(Date.UTC(y, mo! - 1, d)).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Not a valid date (YYYY-MM-DD): "${date}"`);
  }
  return mo! >= 4 ? y : y - 1;
}

/** 2026 → "2026-27" */
export function fyLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** 2026 → "26-27" (used in document numbers, e.g. INV/26-27/0001) */
export function fyShortLabel(startYear: number): string {
  return fyLabel(startYear).slice(2);
}

/** "2026-27" → 2026. Rejects labels whose years aren't consecutive ("2026-28"). */
export function parseFyLabel(label: string): number {
  const m = FY_LABEL.exec(label.trim());
  const start = Number(m?.[1]);
  if (!m || fyLabel(start) !== label.trim()) throw new RangeError(`Not a financial year label (e.g. 2026-27): "${label}"`);
  return start;
}

/** 2026 → "2026-04-01" */
export function fyStart(startYear: number): IsoDate {
  return `${startYear}-04-01`;
}

/** 2026 → "2027-03-31" */
export function fyEnd(startYear: number): IsoDate {
  return `${startYear + 1}-03-31`;
}

/** Start years of the current FY and the `count - 1` before it, newest first. */
export function recentFys(count: number, today: IsoDate = todayInIndia()): number[] {
  const current = fyOf(today);
  return Array.from({ length: count }, (_, i) => current - i);
}
