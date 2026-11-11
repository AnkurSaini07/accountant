// /api/credit-notes (FR-4.6): a credit note against one finalized invoice (GET /new?from=<invoice>,
// then POST), for goods returned (credits qty and value) or a rate difference (value only). No
// line can credit more than its invoice line has left, in qty (returns) or taxable value (both).
// Taxed as its invoice (same place of supply); party_ref is the invoice's number. Draft →
// Finalized; admins cancel with a reason, and what it credited goes back to the invoice.
import type { SQL } from "bun";
import { creditNoteInput, INVOICE_MOVES, INVOICE_STATUSES } from "../../shared/schemas/document.ts";
import { documentRoutes } from "../documents/routes.ts";

export const creditNoteRoutes = (db: SQL) =>
  documentRoutes(db, { type: "credit_note", label: "credit note", key: "credit_notes", input: creditNoteInput, statuses: INVOICE_STATUSES, moves: INVOICE_MOVES, cancel: { from: ["draft", "finalized"] } });
