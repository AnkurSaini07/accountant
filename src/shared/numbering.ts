// Document numbering rules shared by the server (src/server/series) and the Settings → Numbering
// preview, so the preview is exactly what will be printed.
import { fyShortLabel } from "./fy.ts";

export const DOC_TYPES = [
  "quotation", "sales_order", "challan", "invoice", "credit_note", "debit_note",
  "purchase_order", "grn", "purchase_bill", "receipt", "payment", "journal", "contra",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_LABELS: Record<DocType, string> = {
  quotation: "Quotation",
  sales_order: "Sales order",
  challan: "Delivery challan",
  invoice: "Tax invoice",
  credit_note: "Credit note",
  debit_note: "Debit note",
  purchase_order: "Purchase order",
  grn: "Goods receipt (GRN)",
  purchase_bill: "Purchase bill",
  receipt: "Receipt",
  payment: "Payment",
  journal: "Journal",
  contra: "Contra",
};

/** Prefix a series starts with until changed in Settings → Numbering. */
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
export const DEFAULT_PADDING = 4;

export const MAX_LENGTH = 16; // GST: invoice numbers are at most 16 characters
/** GST allows letters, digits, "/" and "-"; {FY} is our placeholder. */
export const PREFIX_PATTERN = /^(?:[A-Za-z0-9/-]|\{FY\})*$/;

/** "INV/{FY}/", 2026, 7, 4 → "INV/26-27/0007". */
export function formatNumber(prefix: string, fy: number, number: number, padding: number): string {
  return prefix.replaceAll("{FY}", fyShortLabel(fy)) + String(number).padStart(padding, "0");
}
