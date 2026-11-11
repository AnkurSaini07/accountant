// A document's totals under its lines: taxable value, the GST that applies (CGST + SGST/UTGST, or
// IGST), round-off and the grand total. Fed by documentTotals, the same code the server stores.
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import type { documentTotals } from "../../shared/document-totals.ts";
import { formatRupees } from "../../shared/money.ts";

const list = style({ display: "grid", gridTemplateColumns: "auto auto", columnGap: 24, rowGap: 4, margin: 0, marginStart: "auto", font: "body" });
const term = style({ color: "gray-700" });
const amount = style({ margin: 0, textAlign: "end", fontVariantNumeric: "tabular-nums" });
const grand = style({ font: "heading-sm", margin: 0, textAlign: "end" });
const problem = style({ font: "body-sm", color: "negative", margin: 0, marginStart: "auto" });

type Totals = ReturnType<typeof documentTotals>;

export function TotalsSummary({ totals }: { totals: Totals | { error: string } }) {
  if ("error" in totals) return <p className={problem}>Totals can't be worked out yet: {totals.error}</p>;
  const rows: [string, number][] = [
    ["Taxable value", totals.taxable_total],
    ...(totals.igst_total ? ([["IGST", totals.igst_total]] as [string, number][]) : [["CGST", totals.cgst_total] as [string, number], [totals.sgst_label, totals.sgst_total] as [string, number]]),
    ["Round off", totals.round_off],
  ];
  return (
    <dl aria-label="Totals" className={list}>
      {rows.map(([name, paise]) => (
        <div key={name} style={{ display: "contents" }}>
          <dt className={term}>{name}</dt>
          <dd className={amount}>{formatRupees(paise)}</dd>
        </div>
      ))}
      <dt className={style({ font: "heading-sm" })}>Total</dt>
      <dd className={grand}>{formatRupees(totals.grand_total, { symbol: true })}</dd>
    </dl>
  );
}
