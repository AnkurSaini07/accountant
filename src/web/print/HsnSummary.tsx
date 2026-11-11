// The HSN/SAC-wise tax summary GST asks for on a tax invoice (Rule 46): one row per HSN and rate,
// built from the saved line amounts, so it adds up to exactly what was saved and posted.
import { formatRupees } from "../../shared/money.ts";

export type TaxedLine = { hsn: string | null; gst_rate: number | string; taxable: number; cgst: number; sgst: number; igst: number };
type Row = { hsn: string; rate: number; taxable: number; cgst: number; sgst: number; igst: number };

export function hsnRows(lines: TaxedLine[]): Row[] {
  const rows = new Map<string, Row>();
  for (const l of lines) {
    const rate = Number(l.gst_rate);
    const hsn = l.hsn ?? "";
    const key = `${hsn}|${rate}`;
    const row = rows.get(key) ?? { hsn, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable += l.taxable;
    row.cgst += l.cgst;
    row.sgst += l.sgst;
    row.igst += l.igst;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate);
}

export function HsnSummary({ lines, sgstLabel }: { lines: TaxedLine[]; sgstLabel: "SGST" | "UTGST" }) {
  const rows = hsnRows(lines);
  const inter = rows.some((r) => r.igst > 0);
  const sum = (k: "taxable" | "cgst" | "sgst" | "igst") => rows.reduce((s, r) => s + r[k], 0);
  const tax = (r: Pick<Row, "cgst" | "sgst" | "igst">) => r.cgst + r.sgst + r.igst;
  return (
    <table className="dp-table dp-hsn" aria-label="HSN/SAC summary">
      <thead>
        <tr>
          <th>HSN/SAC</th>
          <th className="dp-num">Taxable value</th>
          <th className="dp-num">Rate</th>
          {inter ? (
            <th className="dp-num">IGST</th>
          ) : (
            <>
              <th className="dp-num">CGST</th>
              <th className="dp-num">{sgstLabel}</th>
            </>
          )}
          <th className="dp-num">Total tax</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.hsn}|${r.rate}`}>
            <td>{r.hsn}</td>
            <td className="dp-num">{formatRupees(r.taxable)}</td>
            <td className="dp-num">{r.rate}%</td>
            {inter ? (
              <td className="dp-num">{formatRupees(r.igst)}</td>
            ) : (
              <>
                <td className="dp-num">{formatRupees(r.cgst)}</td>
                <td className="dp-num">{formatRupees(r.sgst)}</td>
              </>
            )}
            <td className="dp-num">{formatRupees(tax(r))}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th>Total</th>
          <th className="dp-num">{formatRupees(sum("taxable"))}</th>
          <th />
          {inter ? (
            <th className="dp-num">{formatRupees(sum("igst"))}</th>
          ) : (
            <>
              <th className="dp-num">{formatRupees(sum("cgst"))}</th>
              <th className="dp-num">{formatRupees(sum("sgst"))}</th>
            </>
          )}
          <th className="dp-num">{formatRupees(sum("cgst") + sum("sgst") + sum("igst"))}</th>
        </tr>
      </tfoot>
    </table>
  );
}
