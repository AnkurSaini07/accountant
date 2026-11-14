// A document's totals under its lines: taxable value, the GST that applies (CGST + SGST/UTGST, or
// IGST), round-off and the grand total. Fed by documentTotals, the same code the server stores.
import type { documentTotals } from "../../shared/document-totals.ts";
import { formatRupees } from "../../shared/money.ts";
import classes from "./TotalsSummary.module.css";

type Totals = ReturnType<typeof documentTotals>;

export function TotalsSummary({ totals }: { totals: Totals | { error: string } }) {
  if ("error" in totals) return <p className={classes.problem}>Totals can't be worked out yet: {totals.error}</p>;
  const rows: [string, number][] = [
    ["Taxable value", totals.taxable_total],
    ...(totals.igst_total ? ([["IGST", totals.igst_total]] as [string, number][]) : [["CGST", totals.cgst_total] as [string, number], [totals.sgst_label, totals.sgst_total] as [string, number]]),
    ["Round off", totals.round_off],
  ];
  return (
    <dl aria-label="Totals" className={classes.list}>
      {rows.map(([name, paise]) => (
        <div key={name} style={{ display: "contents" }}>
          <dt className={classes.term}>{name}</dt>
          <dd className={classes.amount}>{formatRupees(paise)}</dd>
        </div>
      ))}
      <dt className={classes.grandTerm}>Total</dt>
      <dd className={classes.grand}>{formatRupees(totals.grand_total, { symbol: true })}</dd>
    </dl>
  );
}
