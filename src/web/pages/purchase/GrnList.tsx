// Purchase → GRNs (FR-5.2): goods received, with the supplier's challan no. Stores (operators)
// record them: fresh, or "Receive against PO" (a supplier's sent POs with something still to come).
import { call, client } from "../../api.ts";
import { DocumentList, type StatusInfo } from "../../components/DocumentList.tsx";
import { FromDocuments } from "../../components/FromDocuments.tsx";

export const GRN_STATUS: StatusInfo = {
  draft: { label: "Draft", badge: "neutral" },
  finalized: { label: "Received", badge: "positive" },
  cancelled: { label: "Cancelled", badge: "negative" },
};
export const GRN_WRITERS = ["admin", "accountant", "operator"]; // stores receives the goods

export function GrnList() {
  return (
    <DocumentList
      title="Goods received (GRNs)"
      noun="GRNs"
      basePath="/purchase/grns"
      newLabel="New GRN"
      statuses={GRN_STATUS}
      writers={GRN_WRITERS}
      actions={
        <FromDocuments
          button="Receive against PO"
          heading="Receive against purchase orders"
          partyLabel="Supplier"
          partyKind="supplier"
          listLabel="Purchase orders"
          open={["finalized"]}
          load={async (query) => (await call(client.api["purchase-orders"].$get({ query }))).purchase_orders}
          empty={(name) => `${name} has no sent purchase orders with anything still to receive this year.`}
          action="Receive goods"
          to="/purchase/grns/new"
        />
      }
      load={async (query) => {
        const r = await call(client.api.grns.$get({ query }));
        return { total: r.total, rows: r.grns };
      }}
      columns={[{ label: "Supplier challan", cell: (r) => r.party_ref ?? "" }]}
    />
  );
}
