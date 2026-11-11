// Sales → Quotations → New / open (FR-4.1): Draft → Sent → Accepted / Rejected / Expired; a sent or
// accepted quotation turns into a sales order.
import { QUOTATION_MOVES } from "../../../shared/schemas/document.ts";
import { call, client } from "../../api.ts";
import { type DocApi, DocumentForm } from "../../components/DocumentForm.tsx";
import { QUOTATION_STATUS } from "./QuotationList.tsx";

const q = client.api.quotations;
const api: DocApi = {
  get: (id) => call(q[":id"].$get({ param: { id } })),
  create: (json) => call(q.$post({ json })),
  update: (id, json) => call(q[":id"].$put({ param: { id }, json })),
  move: (id, status) => call(q[":id"].status.$post({ param: { id }, json: { status: status as "sent" } })),
};

export function QuotationForm() {
  return (
    <DocumentForm
      type="quotation"
      label="quotation"
      plural="quotations"
      listPath="/sales/quotations"
      api={api}
      partyLabel="Customer"
      partyKind="customer"
      side="sale"
      statuses={QUOTATION_STATUS}
      moves={QUOTATION_MOVES}
      moveLabels={{ sent: "Mark as sent", accepted: "Accepted", rejected: "Rejected", expired: "Expired" }}
      dueLabel="Valid until"
      termsHelp="Printed on the quotation: prices, delivery, payment, validity."
      printPath={(id) => `/print/quotations/${id}`}
      converts={[{ label: "Create sales order", when: ["sent", "accepted"], href: (d) => `/sales/orders/new?from=${d.id}` }]}
    />
  );
}
