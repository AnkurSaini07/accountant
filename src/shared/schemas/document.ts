// The document a client sends to create or update a draft (quotation … debit note), validated the
// same on the server and in the forms. Amounts are absent on purpose: the server works them out
// (documentTotals), and any a client sends are dropped by the schema.
import { z } from "zod";
import { partyAddressInput } from "./party.ts";

export const DOCUMENT_TYPES = [
  "quotation", "sales_order", "challan", "invoice", "credit_note",
  "purchase_order", "grn", "purchase_bill", "debit_note",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const CHALLAN_TYPES = ["sale", "job_work", "approval", "returnable"] as const;

const isoDate = z.iso.date("Enter a date.");
const text = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);
const whole = (what: string, min: number) =>
  z.number().int(`${what} must be a whole number of the smallest unit.`).min(min, min ? `${what} must be more than 0.` : "Can't be negative.").refine(Number.isSafeInteger, `${what} is too large.`);

export const documentLineInput = z.object({
  item_id: z.number().int().positive("Choose an item."),
  description: z.string().trim().max(1000).default(""),
  qty: whole("Quantity", 1), // in the unit's smallest step (1.250 KGS = 1250)
  rate: whole("Rate", 0), // paise per whole unit
  discount_bp: z.number().int().min(0, "Can't be negative.").max(10000, "At most 100%.").default(0), // 1250 = 12.50%
  gst_rate: z.number().min(0).max(100).refine((v) => Number.isInteger(v * 100), "At most 2 decimals."),
  from_line_id: z.number().int().positive().nullish(), // the source line this converts (order line, challan line…)
});

/** Every field any document can carry. `documentInput` adds the cross-field rules; each type's API
 *  narrows it (e.g. quotationInput). */
export const documentFields = z.object({
  type: z.enum(DOCUMENT_TYPES),
  date: isoDate,
  party_id: z.number().int().positive("Choose a party."),
  shipping_address: partyAddressInput.omit({ kind: true }).nullish().transform((v) => v ?? null), // null = ship to the billing address
  place_of_supply: partyAddressInput.shape.state_code.nullish().transform((v) => v ?? null), // null = worked out from ship-to / party
  reverse_charge: z.boolean().default(false),
  party_ref: text(50), // customer PO no., supplier invoice no.
  party_ref_date: isoDate.nullish().transform((v) => v ?? null),
  due_date: isoDate.nullish().transform((v) => v ?? null),
  challan_type: z.enum(CHALLAN_TYPES).nullish().transform((v) => v ?? null),
  vehicle_no: text(20),
  transporter: text(100),
  eway_bill_no: z.string().nullish().transform((v) => v?.replace(/\s/g, "") || null).refine((v) => v === null || /^[0-9]{12}$/.test(v), "E-way bill number is 12 digits."),
  notes: z.string().trim().max(2000).default(""),
  terms: z.string().trim().max(4000).default(""),
  lines: z.array(documentLineInput).min(1, "Add at least one line.").max(500),
});

export const documentInput = documentFields.superRefine((d, ctx) => {
  if (d.type === "challan" && !d.challan_type) ctx.addIssue({ code: "custom", path: ["challan_type"], message: "Choose the challan type." });
  if (d.type !== "challan" && d.challan_type) ctx.addIssue({ code: "custom", path: ["challan_type"], message: "Only challans have a challan type." });
});
export type DocumentInput = z.output<typeof documentInput>;

/** One non-challan type's input: no type to send (the URL says it) and no challan fields. */
const inputFor = (type: Exclude<DocumentType, "challan">) =>
  documentFields
    .omit({ type: true, challan_type: true, vehicle_no: true, transporter: true, eway_bill_no: true })
    .transform((d): DocumentInput => ({ ...d, type, challan_type: null, vehicle_no: null, transporter: null, eway_bill_no: null }));

/** A quotation (FR-4.1). */
export const quotationInput = inputFor("quotation");
/** A sales order (FR-4.2): party_ref / party_ref_date are the customer's PO number and date. */
export const salesOrderInput = inputFor("sales_order");

/** Quotation status moves (FR-4.1): Draft → Sent → Accepted / Rejected / Expired. */
export const QUOTATION_MOVES = { draft: ["sent"], sent: ["accepted", "rejected", "expired"] } as const satisfies Record<string, readonly string[]>;
export const QUOTATION_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;
/** Sales order moves (FR-4.2): Draft → Finalized (confirmed; challans and invoices can be made from it) → Cancelled. */
export const SALES_ORDER_MOVES = { draft: ["finalized", "cancelled"], finalized: ["cancelled"] } as const satisfies Record<string, readonly string[]>;
export const SALES_ORDER_STATUSES = ["draft", "finalized", "cancelled"] as const;
