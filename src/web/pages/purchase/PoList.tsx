// Purchase → Orders (FR-5.1): what we've ordered from suppliers, the delivery date and how much
// has been received (GRNs draw on each PO's pending qty).
import { call, client } from "../../api.ts";
import { DocumentList, formatDate, type StatusInfo } from "../../components/DocumentList.tsx";
import { Receipt } from "./Receipt.tsx";

export const PO_STATUS: StatusInfo = {
  draft: { label: "Draft", badge: "neutral" },
  finalized: { label: "Sent", badge: "informative" },
  cancelled: { label: "Cancelled", badge: "negative" },
};

export function PoList() {
  return (
    <DocumentList
      title="Purchase orders"
      noun="purchase orders"
      basePath="/purchase/orders"
      newLabel="New purchase order"
      statuses={PO_STATUS}
      load={async (query) => {
        const r = await call(client.api["purchase-orders"].$get({ query }));
        return { total: r.total, rows: r.purchase_orders };
      }}
      columns={[
        { label: "Delivery by", cell: (r) => (r.due_date ? formatDate(r.due_date) : "") },
        { label: "Received", cell: (r) => <Receipt row={r} /> },
      ]}
    />
  );
}
