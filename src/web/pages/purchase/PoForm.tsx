// Purchase → Orders → New / open (FR-5.1): supplier, delivery date, the supplier's quotation, lines
// at purchase prices, terms; Draft → Sent (finalized: locked, printable for the supplier) → Cancelled;
// once sent, ordered / received / pending per line.
import { SALES_ORDER_MOVES } from "../../../shared/schemas/document.ts";
import { call, client } from "../../api.ts";
import { type DocApi, DocumentForm } from "../../components/DocumentForm.tsx";
import { PO_STATUS } from "./PoList.tsx";

const po = client.api["purchase-orders"];
const api: DocApi = {
  get: (id) => call(po[":id"].$get({ param: { id } })),
  create: (json) => call(po.$post({ json })),
  update: (id, json) => call(po[":id"].$put({ param: { id }, json })),
  move: (id, status) => call(po[":id"].status.$post({ param: { id }, json: { status: status as "finalized" } })),
};

export function PoForm() {
  return (
    <DocumentForm
      type="purchase_order"
      label="purchase order"
      plural="purchase orders"
      listPath="/purchase/orders"
      api={api}
      partyLabel="Supplier"
      partyKind="supplier"
      side="purchase"
      statuses={PO_STATUS}
      moves={SALES_ORDER_MOVES}
      moveLabels={{ finalized: "Mark as sent", cancelled: "Cancel order" }}
      dueLabel="Delivery by"
      refLabels={{ ref: "Supplier's quotation no.", date: "Quotation date" }}
      termsHelp="Printed on the PO: delivery, payment, inspection, packing."
      progress="Received"
      printPath={(id) => `/print/purchase-orders/${id}`}
      converts={[{ label: "Receive goods", when: ["finalized"], href: (d) => `/purchase/grns/new?from=${d.id}` }]}
    />
  );
}
