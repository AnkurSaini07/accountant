// /api/grns (FR-5.2): goods received, against purchase orders (GET /new?from=…, then POST) or
// fresh. Each line's qty is what we accepted; rejected_qty what went back (received = both). The
// accepted qty comes off the PO's pending; party_ref is the supplier's challan no. Draft →
// Finalized (received; stock goes up with the inventory issues) → Cancelled (back on the PO).
import type { SQL } from "bun";
import { CHALLAN_MOVES, CHALLAN_STATUSES, grnInput } from "../../shared/schemas/document.ts";
import { documentRoutes } from "../documents/routes.ts";

export const grnRoutes = (db: SQL) =>
  documentRoutes(db, { type: "grn", label: "GRN", key: "grns", input: grnInput, statuses: CHALLAN_STATUSES, moves: CHALLAN_MOVES, writers: ["admin", "accountant", "operator"] }); // stores records what came in, as challans
