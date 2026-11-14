// Number and date formatting the dashboard's parts share.
import { formatRupees } from "../../../shared/money.ts";

export const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short" });

/** Whole rupees for headline numbers: "₹1,13,200" (paise are on the documents). */
export const wholeRupees = (p: number) => formatRupees(Math.round(p / 100) * 100, { symbol: true }).replace(/\.00$/, "");

/** A step a little above `max` that divides cleanly into 4 gridlines (1, 2, 2.5 or 5 × 10ⁿ). */
export function niceCeiling(max: number): number {
  if (max <= 0) return 0;
  const step = max / 4;
  const pow = 10 ** Math.floor(Math.log10(step));
  const nice = [1, 2, 2.5, 5, 10].find((m) => m * pow >= step)!;
  return nice * pow * 4;
}

export { note as empty } from "../../components/formLayout.ts";
