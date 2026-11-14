// Sales → Orders (FR-4.2): with the customer's PO and how much has been delivered.
import { call, client } from "../../api.ts";
import { DocumentList, type StatusInfo } from "../../components/DocumentList.tsx";
import { FromDocuments } from "../../components/FromDocuments.tsx";
import { Delivery } from "./Delivery.tsx";

export const ORDER_STATUS: StatusInfo = {
  draft: { label: "Draft", badge: "neutral" },
  finalized: { label: "Confirmed", badge: "informative" },
  cancelled: { label: "Cancelled", badge: "negative" },
};

export function OrderList() {
  return (
    <DocumentList
      title="Sales orders"
      noun="sales orders"
      basePath="/sales/orders"
      newLabel="New sales order"
      statuses={ORDER_STATUS}
      actions={
        <FromDocuments
          button="From quotations"
          heading="Sales order from quotations"
          partyLabel="Customer"
          partyKind="customer"
          listLabel="Quotations"
          open={["sent", "accepted"]}
          load={async (query) => (await call(client.api.quotations.$get({ query }))).quotations}
          empty={(name) => `${name} has no sent or accepted quotations with anything left to order this year.`}
          action="Create order"
          to="/sales/orders/new"
        />
      }
      load={async (query) => {
        const r = await call(client.api["sales-orders"].$get({ query }));
        return { total: r.total, rows: r.sales_orders };
      }}
      columns={[
        { label: "Customer PO", cell: (r) => r.party_ref ?? "" },
        { label: "Delivery", cell: (r) => <Delivery row={r} /> },
      ]}
    />
  );
}
