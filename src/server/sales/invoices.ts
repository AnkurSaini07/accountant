// /api/invoices (FR-4.4): tax invoices, fresh or from challans, sales orders or quotations (GET
// /new?from=…, then POST). Place of supply (ship-to state, else the customer's) decides CGST + SGST
// or IGST; reverse charge, transport and e-way bill ride along. Unregistered customers need no
// GSTIN. Draft → Finalized (locked; POST /:id/status). POST /:id/cancel: admins, with a reason;
// the number stays used and the invoiced qty goes back to its challans / orders.
import type { SQL } from "bun";
import { INVOICE_MOVES, INVOICE_STATUSES, invoiceInput } from "../../shared/schemas/document.ts";
import { documentRoutes } from "../documents/routes.ts";

export const invoiceRoutes = (db: SQL) =>
  documentRoutes(db, { type: "invoice", label: "invoice", key: "invoices", input: invoiceInput, statuses: INVOICE_STATUSES, moves: INVOICE_MOVES, cancel: { from: ["draft", "finalized"] } });
