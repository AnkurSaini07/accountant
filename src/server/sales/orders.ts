// /api/sales-orders (FR-4.2): fresh or from quotations (GET /new?from=…, then POST; the quotations
// become accepted). party_ref / party_ref_date carry the customer's PO; each line reports what's
// still pending for challans and invoices. Draft → Finalized → Cancelled.
import type { SQL } from "bun";
import { SALES_ORDER_MOVES, SALES_ORDER_STATUSES, salesOrderInput } from "../../shared/schemas/document.ts";
import { documentRoutes } from "../documents/routes.ts";

export const salesOrderRoutes = (db: SQL) =>
  documentRoutes(db, { type: "sales_order", label: "sales order", key: "sales_orders", input: salesOrderInput, statuses: SALES_ORDER_STATUSES, moves: SALES_ORDER_MOVES });
