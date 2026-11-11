// Sales → Invoices → New / open (FR-4.4, 4.5): fresh, or from challans / sales orders (?from=…);
// ship-to (it decides CGST + SGST or IGST, shown live), reverse charge, transport and e-way bill.
// Finalize locks it (asks first); admins cancel it with a reason, and its number stays used.
import { INVOICE_MOVES } from "../../../shared/schemas/document.ts";
import { call, client } from "../../api.ts";
import { type DocApi, DocumentForm } from "../../components/DocumentForm.tsx";
import { INVOICE_STATUS } from "./InvoiceList.tsx";

const inv = client.api.invoices;
const api: DocApi = {
  get: (id) => call(inv[":id"].$get({ param: { id } })),
  create: (json) => call(inv.$post({ json })),
  update: (id, json) => call(inv[":id"].$put({ param: { id }, json })),
  move: (id, status) => call(inv[":id"].status.$post({ param: { id }, json: { status: status as "finalized" } })),
  draftFrom: (from) => call(inv.new.$get({ query: { from } })),
  cancel: (id, reason) => call(inv[":id"].cancel.$post({ param: { id }, json: { reason } })),
};

export function InvoiceForm() {
  return (
    <DocumentForm
      type="invoice"
      label="invoice"
      plural="invoices"
      listPath="/sales/invoices"
      api={api}
      partyLabel="Customer"
      partyKind="customer"
      side="sale"
      statuses={INVOICE_STATUS}
      moves={INVOICE_MOVES}
      moveLabels={{ finalized: "Finalize invoice" }}
      confirm={["finalized"]}
      dueLabel="Payment due"
      refLabels={{ ref: "Customer PO no.", date: "PO date" }}
      shipTo
      transport
      reverseCharge
      printPath={(id) => `/print/invoices/${id}`}
    />
  );
}
