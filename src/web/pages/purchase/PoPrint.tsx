// /print/purchase-orders/:id: the PO to send to the supplier: our letterhead, the supplier, deliver
// to our works, delivery date, lines at our rates with GST, terms, signature. No bank details.
import { call, client } from "../../api.ts";
import { PrintPage } from "../../print/PrintPage.tsx";

export function PoPrint() {
  return (
    <PrintPage
      load={(id) => call(client.api["purchase-orders"][":id"].$get({ param: { id } }))}
      label="purchase order"
      back={(id) => `/purchase/orders/${id}`}
      title={() => "Purchase Order"}
      partyLabel="Supplier"
      dueLabel="Delivery by"
      refLabel="Your quotation"
      refDateLabel="Quotation date"
      ours
    />
  );
}
