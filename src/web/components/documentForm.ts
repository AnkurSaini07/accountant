// Types shared by DocumentForm (the loader) and DocumentEditor (the screen).
import type { InferResponseType } from "hono/client";
import type { DocumentType } from "../../shared/schemas/document.ts";
import type { client } from "../api.ts";
import type { StatusInfo } from "./DocumentList.tsx";
import { linesBody } from "./LineItems.tsx";
import type { ShipTo } from "./ShipToPicker.tsx";
import type { DocApi } from "./DocumentForm.tsx";

/** A saved document as GET /api/<documents>/:id returns it (documents/get.sql + pending per line). */
export type Doc = InferResponseType<(typeof client.api.quotations)[":id"]["$get"], 200>;

/** A new draft from source documents (GET /api/<documents>/new?from=…). */
export type Draft = InferResponseType<(typeof client.api)["sales-orders"]["new"]["$get"], 200>;

export type Body = { party_id: number; date: string; due_date: string | null; party_ref: string | null; party_ref_date: string | null; terms: string; notes: string; lines: ReturnType<typeof linesBody>["lines"];
  // Only on types that have them (config.shipTo, config.challanTypes):
  shipping_address?: ShipTo | null;
  challan_type?: "sale" | "job_work" | "approval" | "returnable";
  note_reason?: "return" | "rate_difference";
  vehicle_no?: string | null;
  transporter?: string | null;
  eway_bill_no?: string | null;
  reverse_charge?: boolean;
};

export type DocConfig = {
  type: DocumentType;
  label: string; // "quotation"
  plural: string; // "quotations"
  listPath: string; // "/sales/quotations"
  api: DocApi;
  partyLabel: string; // "Customer"
  partyKind: "customer" | "supplier";
  side: "sale" | "purchase";
  statuses: StatusInfo;
  moves: Partial<Record<string, readonly string[]>>;
  moveLabels: Record<string, string>; // the button for each move: { sent: "Mark as sent" }
  dueLabel?: string; // what due_date means here: "Valid until", "Deliver by"; none: no due date
  refLabels?: { ref: string; date: string }; // party_ref and its date: "Customer PO no.", "PO date"
  termsHelp?: string;
  printPath?: (id: number) => string;
  progress?: string; // for an order: the column for what's been converted ("Delivered")
  converts?: { label: string; when: readonly string[]; href: (doc: Doc) => string }[]; // "Create sales order" on a sent quotation
  writers?: string[];
  shipTo?: boolean; // a Ship to picker (challans, invoices)
  challanTypes?: Record<string, string>; // a challan: its type (required)
  noteReasons?: Record<string, string>; // a credit / debit note: why (required)
  transport?: boolean; // vehicle no., transporter, e-way bill no. (challans, invoices)
  reverseCharge?: boolean; // the reverse-charge flag (invoices, bills)
  confirm?: string[]; // more moves to ask about first, e.g. finalizing an invoice locks it
  rejected?: boolean; // a GRN: lines record accepted and rejected qty
};

export { factLabel, note } from "./formLayout.ts";
