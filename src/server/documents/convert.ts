// Conversions (FR-4.1…4.4, 5.1…5.3): quotation → order → challan → invoice, PO → GRN → bill, and
// invoice/bill → credit/debit note. A converted line names its source (`from_line_id`); saving
// records how much it took in document_links, and no source line can give more than is pending.
import type { SQL } from "bun";
import { todayInIndia } from "../../shared/fy.ts";
import { formatQty } from "../../shared/quantity.ts";
import type { DocumentInput, DocumentType } from "../../shared/schemas/document.ts";
import { ValidationError } from "../errors.ts";
import insertLinks from "./insert_links.sql";
import lockLines from "./lock_lines.sql";
import pendingQuery from "./pending.sql";
import { saveDocument } from "./service.ts";

/** Which documents each type can be made from. */
export const SOURCES: Partial<Record<DocumentType, readonly DocumentType[]>> = {
  sales_order: ["quotation"],
  challan: ["sales_order"],
  invoice: ["quotation", "sales_order", "challan"],
  credit_note: ["invoice"],
  grn: ["purchase_order"],
  purchase_bill: ["purchase_order", "grn"],
  debit_note: ["purchase_bill"],
};
// Drafts aren't issued yet; rejected, expired and cancelled ones are dead.
const CONVERTIBLE = new Set(["sent", "accepted", "finalized"]);
const LABELS: Record<DocumentType, string> = {
  quotation: "quotation", sales_order: "sales order", challan: "challan", invoice: "invoice", credit_note: "credit note",
  purchase_order: "purchase order", grn: "GRN", purchase_bill: "purchase bill", debit_note: "debit note",
};

const pending = async (db: SQL, args: { company_id: number; document_ids: number[]; line_ids: number[] }) =>
  (await pendingQuery.run(db, args)).map((r) => ({ ...r, pending: r.pending! })); // coalesce'd in SQL; reylo can't tell
export type PendingLine = Awaited<ReturnType<typeof pending>>[number];

/** Every line of these documents with its pending qty (0 when fully converted). */
export const pendingLines = (db: SQL, { companyId, documentIds }: { companyId: number; documentIds: number[] }) =>
  pending(db, { company_id: companyId, document_ids: documentIds, line_ids: [] });

type NewLine = { item_id: number; qty: number; from_line_id?: number | null };

/**
 * Inside saveDocument's transaction, once the lines are in: checks each converted line against its
 * source and records the links. Throws ValidationError naming the line's field.
 */
export async function linkLines(tx: SQL, { companyId, type, partyId, lines, lineIds }: { companyId: number; type: DocumentType; partyId: number; lines: NewLine[]; lineIds: number[] }) {
  const ids = [...new Set(lines.flatMap((l) => (l.from_line_id ? [l.from_line_id] : [])))];
  if (!ids.length) return;
  await lockLines.run(tx, { ids });
  const sources = new Map((await pending(tx, { company_id: companyId, document_ids: [], line_ids: ids })).map((s) => [s.id, s]));

  const errors: Record<string, string[]> = {};
  const taken = new Map<number, number>(); // source line → qty this document takes from it so far
  lines.forEach((l, i) => {
    if (!l.from_line_id) return;
    const s = sources.get(l.from_line_id);
    const at = (field: string, message: string) => (errors[`lines.${i}.${field}`] ??= [message]);
    if (!s) return at("from_line_id", "That source line isn't on any of this company's documents.");
    const source = `${LABELS[s.type as DocumentType]} ${s.number ?? "draft"}`;
    if (!SOURCES[type]?.includes(s.type as DocumentType)) return at("from_line_id", `A ${LABELS[type]} can't be made from a ${LABELS[s.type as DocumentType]}.`);
    if (!CONVERTIBLE.has(s.status)) return at("from_line_id", `The ${source} is ${s.status}, so it can't be converted.`);
    if (s.party_id !== partyId) return at("from_line_id", `The ${source} is for another party.`);
    if (s.item_id !== l.item_id) return at("item_id", `Line ${s.position} of the ${source} is ${s.item_name}; keep that item.`);
    const total = (taken.get(s.id) ?? 0) + l.qty;
    taken.set(s.id, total);
    if (total > s.pending) at("qty", `Only ${formatQty(s.pending, s.unit_decimals)} ${s.unit} of line ${s.position} of the ${source} is still pending.`);
  });
  if (Object.keys(errors).length) throw new ValidationError("Some lines take more than their source has, or come from the wrong document.", errors);

  const rows = lines.flatMap((l, i) => (l.from_line_id ? [{ from_line_id: l.from_line_id, to_line_id: lineIds[i]!, qty: l.qty }] : []));
  await insertLinks.run(tx, { rows });
}

/**
 * A new draft of `type` made from source documents (all for one party): their pending lines, each
 * for its full pending qty, plus the first source's ship-to, references and terms. Edit before
 * saving, or pass it straight to saveDocument (convertDocument).
 */
export async function draftFrom(db: SQL, { companyId, type, sourceIds }: { companyId: number; type: DocumentType; sourceIds: number[] }): Promise<DocumentInput> {
  const lines = await pendingLines(db, { companyId, documentIds: sourceIds });
  const found = new Set(lines.map((l) => l.document_id));
  const missing = sourceIds.filter((id) => !found.has(id));
  if (missing.length) throw new ValidationError(`Document ${missing.join(", ")} wasn't found.`, { source_ids: ["Choose documents from the list."] });
  if (new Set(lines.map((l) => l.party_id)).size > 1) throw new ValidationError("These documents are for different parties.", { source_ids: ["Choose documents for one party."] });
  const open = lines.filter((l) => l.pending > 0);
  if (!open.length) throw new ValidationError("Nothing is pending on these documents.", { source_ids: ["Everything on them has been converted already."] });
  return {
    type,
    date: todayInIndia(),
    party_id: lines[0]!.party_id,
    shipping_address: null,
    place_of_supply: null,
    reverse_charge: false,
    party_ref: null,
    party_ref_date: null,
    due_date: null,
    challan_type: type === "challan" ? "sale" : null,
    vehicle_no: null,
    transporter: null,
    eway_bill_no: null,
    notes: "",
    terms: "",
    lines: open.map((l) => ({ item_id: l.item_id, description: l.description, qty: l.pending, rate: l.rate, discount_bp: l.discount_bp, gst_rate: l.gst_rate, from_line_id: l.id })),
  };
}

/** Creates the draft draftFrom describes (with `changes` on top); returns its id. */
export async function convertDocument(db: SQL, { companyId, userId, type, sourceIds, changes = {} }: { companyId: number; userId: number | null; type: DocumentType; sourceIds: number[]; changes?: Partial<Omit<DocumentInput, "type" | "lines">> }) {
  const doc = { ...(await draftFrom(db, { companyId, type, sourceIds })), ...changes };
  return saveDocument(db, { companyId, userId, doc });
}
