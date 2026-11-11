// A document's amounts, from its lines, worked out on the server. The document service (#40) stores
// these and ignores any amounts a client sends. The maths is calculateGst (src/shared/gst.ts), the
// same code the form uses for live totals. This only maps the stored line shape onto it.
import { calculateGst } from "../../shared/gst.ts";
import { formatQty } from "../../shared/quantity.ts";

/** Documents where we buy: the party is the supplier and the goods come to us. */
export const PURCHASE_TYPES = ["purchase_order", "grn", "purchase_bill", "debit_note"] as const;

export type TotalsInput = {
  type: string;
  companyState: string; // our state code
  partyState: string; // the party's, as snapshotted on the document
  placeOfSupply: string;
  lines: {
    hsn: string | null;
    qty: number; // in the unit's smallest step
    unit_decimals: number;
    rate: number; // paise per whole unit
    discount_bp: number; // 1250 = 12.50%
    gst_rate: number; // percent
  }[];
};

/** Line amounts and document totals, named like the documents / document_lines columns. */
export function documentTotals({ type, companyState, partyState, placeOfSupply, lines }: TotalsInput) {
  const purchase = (PURCHASE_TYPES as readonly string[]).includes(type);
  const gst = calculateGst({
    supplierState: purchase ? partyState : companyState,
    placeOfSupply,
    lines: lines.map((l) => ({
      hsn: l.hsn ?? "", // calculateGst names the line: "Line 2: HSN/SAC must be 4, 6 or 8 digits"
      qty: formatQty(l.qty, l.unit_decimals), // exact decimal text: 1250 with 3 decimals → "1.250"
      rate: l.rate,
      discountPercent: String(l.discount_bp / 100), // basis points / 100 is exact in the shortest form
      gstPercent: l.gst_rate,
    })),
  });
  return {
    lines: gst.lines.map(({ taxable, cgst, sgst, igst }) => ({ taxable, cgst, sgst, igst })),
    hsn_summary: gst.hsnSummary,
    sgst_label: gst.sgstLabel,
    taxable_total: gst.taxable,
    cgst_total: gst.cgst,
    sgst_total: gst.sgst,
    igst_total: gst.igst,
    round_off: gst.roundOff,
    grand_total: gst.grandTotal,
  };
}
