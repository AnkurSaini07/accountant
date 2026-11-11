// GST for a document's lines (invoice, quotation, purchase bill…). Same code runs in the browser
// (live totals while typing) and on the server (the stored, authoritative totals).
//
// Per line: gross = rate × qty, discount = gross × discount%, taxable = gross − discount,
// tax = taxable × GST% (rounded to the paisa, half away from zero).
// Same state as the supplier → tax split into CGST + SGST (UTGST in UTs without a legislature);
// otherwise IGST. The split halves the line's total tax and gives CGST the odd paisa, so
// CGST + SGST always equals what IGST would be: no paisa is lost or invented.
import { assertPaise, multiply, type Paise, percentOf } from "./money.ts";
import { stateByCode } from "./states.ts";

export type GstLineInput = {
  hsn: string; // HSN (goods) or SAC (services), 4/6/8 digits
  qty: number | string;
  rate: Paise; // per unit, before discount and tax
  discountPercent?: number | string;
  gstPercent: number | string; // 0 for nil-rated
  exempt?: boolean; // exempt supply: no tax whatever gstPercent says; reported separately in GSTR-1
};

export type GstLine = {
  hsn: string;
  gstPercent: number;
  exempt: boolean;
  gross: Paise;
  discount: Paise;
  taxable: Paise;
  cgst: Paise;
  sgst: Paise; // SGST or UTGST, see `sgstLabel`
  igst: Paise;
  total: Paise; // taxable + tax
};

export type HsnSummaryRow = Pick<GstLine, "hsn" | "gstPercent" | "taxable" | "cgst" | "sgst" | "igst">;

export type GstResult = {
  interState: boolean;
  sgstLabel: "SGST" | "UTGST";
  lines: GstLine[];
  hsnSummary: HsnSummaryRow[];
  taxable: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  totalBeforeRoundOff: Paise;
  roundOff: Paise; // −49…+50 paise, posted to the Round Off ledger
  grandTotal: Paise; // whole rupees
};

const HSN = /^(\d{4}|\d{6}|\d{8})$/;

function percent(value: number | string | undefined, field: string, line: number): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new RangeError(`Line ${line}: ${field} must be between 0 and 100, got ${value}`);
  return n;
}

export function calculateGst(input: { supplierState: string; placeOfSupply: string; lines: GstLineInput[] }): GstResult {
  const supplier = stateByCode(input.supplierState);
  const pos = stateByCode(input.placeOfSupply);
  if (!supplier) throw new RangeError(`Unknown supplier state code: ${input.supplierState}`);
  if (!pos) throw new RangeError(`Unknown place of supply: ${input.placeOfSupply}`);
  const interState = supplier.code !== pos.code;

  const lines = input.lines.map((l, i): GstLine => {
    const n = i + 1;
    if (!HSN.test(l.hsn)) throw new RangeError(`Line ${n}: HSN/SAC must be 4, 6 or 8 digits, got "${l.hsn}"`);
    if (!(Number(l.qty) > 0)) throw new RangeError(`Line ${n}: quantity must be more than 0, got ${l.qty}`);
    if (assertPaise(l.rate) < 0) throw new RangeError(`Line ${n}: rate can't be negative`);
    const discountPercent = percent(l.discountPercent, "discount %", n);
    const gstPercent = percent(l.gstPercent, "GST %", n);
    const exempt = l.exempt ?? false;

    const gross = multiply(l.rate, l.qty);
    const discount = percentOf(gross, discountPercent);
    const taxable = gross - discount;
    const tax = exempt ? 0 : percentOf(taxable, gstPercent);
    const sgst = interState ? 0 : Math.floor(tax / 2);
    const cgst = interState ? 0 : tax - sgst;
    return { hsn: l.hsn, gstPercent, exempt, gross, discount, taxable, cgst, sgst, igst: interState ? tax : 0, total: taxable + tax };
  });

  const sum = (rows: readonly HsnSummaryRow[], key: "taxable" | "cgst" | "sgst" | "igst") => rows.reduce((t, r) => t + r[key], 0);

  const groups = new Map<string, HsnSummaryRow>();
  for (const l of lines) {
    const key = `${l.hsn}|${l.exempt ? "exempt" : l.gstPercent}`;
    const row = groups.get(key) ?? { hsn: l.hsn, gstPercent: l.exempt ? 0 : l.gstPercent, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable += l.taxable;
    row.cgst += l.cgst;
    row.sgst += l.sgst;
    row.igst += l.igst;
    groups.set(key, row);
  }
  const hsnSummary = [...groups.values()].sort((a, b) => a.hsn.localeCompare(b.hsn) || a.gstPercent - b.gstPercent);

  const taxable = sum(lines, "taxable");
  const cgst = sum(lines, "cgst");
  const sgst = sum(lines, "sgst");
  const igst = sum(lines, "igst");
  const totalBeforeRoundOff = taxable + cgst + sgst + igst;
  const grandTotal = Math.floor((totalBeforeRoundOff + 50) / 100) * 100; // nearest rupee, 50 paise rounds up

  return {
    interState,
    sgstLabel: !interState && pos.utgst ? "UTGST" : "SGST",
    lines,
    hsnSummary,
    taxable,
    cgst,
    sgst,
    igst,
    totalBeforeRoundOff,
    roundOff: grandTotal - totalBeforeRoundOff,
    grandTotal,
  };
}
