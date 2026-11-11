// Sales → Credit notes → New (from an invoice: ?from=<id>) / open: why (goods returned or a rate
// difference), the invoice's lines to credit (fewer, less qty, or the rate difference as the rate),
// taxed like the invoice (its ship-to). The server refuses more than the invoice has left.
import { Navigate, useParams, useSearchParams } from "react-router";
import { INVOICE_MOVES } from "../../../shared/schemas/document.ts";
import { call, client } from "../../api.ts";
import { type DocApi, DocumentForm } from "../../components/DocumentForm.tsx";
import { NOTE_REASONS } from "./CreditNoteList.tsx";
import { INVOICE_STATUS } from "./InvoiceList.tsx";

const cn = client.api["credit-notes"];
const api: DocApi = {
  get: (id) => call(cn[":id"].$get({ param: { id } })),
  create: (json) => call(cn.$post({ json: json as never })), // DocumentForm sends note_reason (noteReasons below)
  update: (id, json) => call(cn[":id"].$put({ param: { id }, json: json as never })),
  move: (id, status) => call(cn[":id"].status.$post({ param: { id }, json: { status: status as "finalized" } })),
  draftFrom: (from) => call(cn.new.$get({ query: { from } })),
  cancel: (id, reason) => call(cn[":id"].cancel.$post({ param: { id }, json: { reason } })),
};

export function CreditNoteForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  if (!id && !params.get("from")) return <Navigate to="/sales/credit-notes" replace />; // only from an invoice
  return (
    <DocumentForm
      type="credit_note"
      label="credit note"
      plural="credit notes"
      listPath="/sales/credit-notes"
      api={api}
      partyLabel="Customer"
      partyKind="customer"
      side="sale"
      statuses={INVOICE_STATUS}
      moves={INVOICE_MOVES}
      moveLabels={{ finalized: "Finalize credit note" }}
      confirm={["finalized"]}
      refLabels={{ ref: "Against invoice", date: "Invoice date" }}
      noteReasons={NOTE_REASONS}
      shipTo
      printPath={(id) => `/print/credit-notes/${id}`}
    />
  );
}
