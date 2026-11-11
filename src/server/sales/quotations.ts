// /api/quotations (FR-4.1): Draft → Sent → Accepted / Rejected / Expired. Admins and accountants
// write (REQUIREMENTS §2: operators make challans and GRNs, not quotations).
import type { SQL } from "bun";
import { QUOTATION_MOVES, QUOTATION_STATUSES, quotationInput } from "../../shared/schemas/document.ts";
import { documentRoutes } from "../documents/routes.ts";

export const quotationRoutes = (db: SQL) =>
  documentRoutes(db, { type: "quotation", label: "quotation", key: "quotations", input: quotationInput, statuses: QUOTATION_STATUSES, moves: QUOTATION_MOVES });
