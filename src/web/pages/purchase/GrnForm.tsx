// Purchase → GRNs → New / open (FR-5.2): fresh, or from purchase orders (?from=…); the supplier's
// challan no. and date, vehicle; per line the accepted and rejected qty (only accepted comes off
// the PO). Draft → Received (finalized) → Cancelled. Stores (operators) can record them.
import { CHALLAN_MOVES } from "../../../shared/schemas/document.ts";
import { call, client } from "../../api.ts";
import { type DocApi, DocumentForm } from "../../components/DocumentForm.tsx";
import { GRN_STATUS, GRN_WRITERS } from "./GrnList.tsx";

const grn = client.api.grns;
const api: DocApi = {
  get: (id) => call(grn[":id"].$get({ param: { id } })),
  create: (json) => call(grn.$post({ json })),
  update: (id, json) => call(grn[":id"].$put({ param: { id }, json })),
  move: (id, status) => call(grn[":id"].status.$post({ param: { id }, json: { status: status as "finalized" } })),
  draftFrom: (from) => call(grn.new.$get({ query: { from } })),
};

export function GrnForm() {
  return (
    <DocumentForm
      type="grn"
      label="GRN"
      plural="GRNs"
      listPath="/purchase/grns"
      api={api}
      partyLabel="Supplier"
      partyKind="supplier"
      side="purchase"
      statuses={GRN_STATUS}
      moves={CHALLAN_MOVES}
      moveLabels={{ finalized: "Mark received", cancelled: "Cancel GRN" }}
      refLabels={{ ref: "Supplier challan no.", date: "Challan date" }}
      transport
      rejected
      writers={GRN_WRITERS}
    />
  );
}
