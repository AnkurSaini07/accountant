import { Label } from "@primer/react";
import type { ListRow } from "../../components/DocumentList.tsx";

/** Not yet / Partly / Received, from the PO's total and still-pending qty. */
export function Receipt({ row }: { row: Pick<ListRow, "status" | "ordered_qty" | "pending_qty"> }) {
  if (row.status !== "finalized") return null;
  const pending = row.pending_qty ?? 0;
  if (pending === 0) return <Label variant="success">Received</Label>;
  if (pending < (row.ordered_qty ?? 0)) return <Label variant="attention">Partly received</Label>;
  return <Label variant="secondary">Not received</Label>;
}
