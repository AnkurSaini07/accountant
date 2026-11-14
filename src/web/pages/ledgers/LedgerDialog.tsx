// The new / edit ledger dialog. The group picker shows the chart of accounts as a tree: a heading
// per primary group, listing the group itself and its sub-groups. System ledgers (Cash, Sales, the
// GST ledgers…), party ledgers (they follow their party) and readers other than admins and
// accountants see it read-only.
import { LedgerEditor } from "./LedgerEditor.tsx";
import type { LedgerRow } from "./ledger.ts";

type Props = { open: LedgerRow | "new" | null; canWrite: boolean; onClose: () => void; onSaved: () => void };

export function LedgerDialog({ open, canWrite, onClose, onSaved }: Props) {
  if (!open) return null;
  return <LedgerEditor key={open === "new" ? "new" : open.id} ledger={open === "new" ? null : open} canWrite={canWrite} onClose={onClose} onSaved={onSaved} />;
}
