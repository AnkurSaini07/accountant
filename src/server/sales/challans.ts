// /api/challans (FR-4.3): delivery challans, fresh or from confirmed sales orders (GET /new?from=…,
// then POST). Sale, job work, supply on approval or returnable; vehicle no., transporter, e-way
// bill no., ship-to. The floor writes them, so operators can too. Draft → Finalized → Cancelled.
import type { SQL } from "bun";
import { CHALLAN_MOVES, CHALLAN_STATUSES, challanInput } from "../../shared/schemas/document.ts";
import { documentRoutes } from "../documents/routes.ts";

export const challanRoutes = (db: SQL) =>
  documentRoutes(db, { type: "challan", label: "challan", key: "challans", input: challanInput, statuses: CHALLAN_STATUSES, moves: CHALLAN_MOVES, writers: ["admin", "accountant", "operator"] });
