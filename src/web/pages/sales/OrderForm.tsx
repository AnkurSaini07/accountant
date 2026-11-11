// Sales → Orders → New / open (FR-4.2): fresh, or from quotations (?from=…); the customer's PO no.
// and date; Draft → Confirmed → Cancelled; once confirmed, ordered / delivered / pending per line.
import { SALES_ORDER_MOVES } from "../../../shared/schemas/document.ts";
import { call, client } from "../../api.ts";
import { type DocApi, DocumentForm } from "../../components/DocumentForm.tsx";
import { ORDER_STATUS } from "./OrderList.tsx";

const so = client.api["sales-orders"];
const api: DocApi = {
  get: (id) => call(so[":id"].$get({ param: { id } })),
  create: (json) => call(so.$post({ json })),
  update: (id, json) => call(so[":id"].$put({ param: { id }, json })),
  move: (id, status) => call(so[":id"].status.$post({ param: { id }, json: { status: status as "finalized" } })),
  draftFrom: (from) => call(so.new.$get({ query: { from } })),
};

export function OrderForm() {
  return (
    <DocumentForm
      type="sales_order"
      label="sales order"
      plural="sales orders"
      listPath="/sales/orders"
      api={api}
      partyLabel="Customer"
      partyKind="customer"
      side="sale"
      statuses={ORDER_STATUS}
      moves={SALES_ORDER_MOVES}
      moveLabels={{ finalized: "Confirm order", cancelled: "Cancel order" }}
      dueLabel="Deliver by"
      refLabels={{ ref: "Customer PO no.", date: "PO date" }}
      progress="Delivered"
    />
  );
}
