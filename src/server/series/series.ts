// Document numbers: `await nextNumber(tx, { companyId, docType: "invoice", date })` → "INV/26-27/0001".
// Call it inside the transaction that saves the document, so the number and the document commit (or
// roll back) together: numbers stay consecutive with no gaps (FR-1.4).
import type { SQL } from "bun";
import { fyOf, fyShortLabel, type IsoDate } from "../../shared/fy.ts";
import { AppError } from "../errors.ts";
import takeNumber from "./take_number.sql";

export const DOC_TYPES = [
  "quotation", "sales_order", "challan", "invoice", "credit_note", "debit_note",
  "purchase_order", "grn", "purchase_bill", "receipt", "payment", "journal", "contra",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** Prefix a series starts with; editable per FY in Settings (#25). */
export const DEFAULT_PREFIX: Record<DocType, string> = {
  quotation: "QTN/{FY}/",
  sales_order: "SO/{FY}/",
  challan: "DC/{FY}/",
  invoice: "INV/{FY}/",
  credit_note: "CN/{FY}/",
  debit_note: "DN/{FY}/",
  purchase_order: "PO/{FY}/",
  grn: "GRN/{FY}/",
  purchase_bill: "PB/{FY}/",
  receipt: "RCT/{FY}/",
  payment: "PMT/{FY}/",
  journal: "JV/{FY}/",
  contra: "CTR/{FY}/",
};

export const MAX_LENGTH = 16; // GST: invoice numbers are at most 16 characters

/** "INV/{FY}/", 2026, 7, 4 → "INV/26-27/0007". */
export function formatNumber(prefix: string, fy: number, number: number, padding: number): string {
  return prefix.replaceAll("{FY}", fyShortLabel(fy)) + String(number).padStart(padding, "0");
}

/** Reserves and returns the next document number for `date`'s financial year. */
export async function nextNumber(tx: SQL, { companyId, docType, date }: { companyId: number; docType: DocType; date: IsoDate }) {
  const fy = fyOf(date);
  // Always a row: the conflict branch updates (never "do nothing"). Reylo types upserts as row | null.
  const row = (await takeNumber.run(tx, { company_id: companyId, doc_type: docType, fy, default_prefix: DEFAULT_PREFIX[docType] }))!;
  const formatted = formatNumber(row.prefix, fy, row.number, row.padding);
  if (formatted.length > MAX_LENGTH) {
    // Thrown inside the caller's transaction, so the number taken above is given back on rollback.
    throw new AppError(
      422,
      "NUMBER_TOO_LONG",
      `Document number ${formatted} is longer than ${MAX_LENGTH} characters (GST limit). Shorten the ${docType.replace("_", " ")} prefix in Settings → Number series.`,
      { number: formatted },
    );
  }
  return formatted;
}
