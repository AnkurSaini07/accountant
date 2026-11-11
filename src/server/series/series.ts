// Document numbers: `await nextNumber(tx, { companyId, docType: "invoice", date })` → "INV/26-27/0001".
// Call it inside the transaction that saves the document, so the number and the document commit (or
// roll back) together: numbers stay consecutive with no gaps (FR-1.4).
import type { SQL } from "bun";
import { fyOf, type IsoDate } from "../../shared/fy.ts";
import { DEFAULT_PREFIX, type DocType, MAX_LENGTH, formatNumber } from "../../shared/numbering.ts";
import { AppError } from "../errors.ts";
import takeNumber from "./take_number.sql";

export { DOC_TYPES, type DocType, DEFAULT_PREFIX, MAX_LENGTH, formatNumber } from "../../shared/numbering.ts";

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
