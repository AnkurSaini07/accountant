// /api/purchase-orders (FR-5.1): what we order from a supplier, with the delivery date (due_date),
// terms and lines; each line reports what's still pending for GRNs and purchase bills. Goods come
// to us, so the place of supply is our state: an out-of-state supplier means IGST.
// Draft → Finalized (sent to the supplier) → Cancelled.
import type { SQL } from "bun";
import { purchaseOrderInput, SALES_ORDER_MOVES, SALES_ORDER_STATUSES } from "../../shared/schemas/document.ts";
import { documentRoutes } from "../documents/routes.ts";

export const purchaseOrderRoutes = (db: SQL) =>
  documentRoutes(db, { type: "purchase_order", label: "purchase order", key: "purchase_orders", input: purchaseOrderInput, statuses: SALES_ORDER_STATUSES, moves: SALES_ORDER_MOVES });
