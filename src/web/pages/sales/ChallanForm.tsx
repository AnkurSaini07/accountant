// Sales → Challans → New / open (FR-4.3): fresh, or from confirmed sales orders (?from=…); challan
// type, ship-to, vehicle, transporter and e-way bill; Draft → Issued → Cancelled. Operators too.
import { CHALLAN_MOVES } from "../../../shared/schemas/document.ts";
import { call, client } from "../../api.ts";
import { type DocApi, DocumentForm } from "../../components/DocumentForm.tsx";
import { CHALLAN_STATUS, CHALLAN_TYPES, WRITERS } from "./ChallanList.tsx";

const dc = client.api.challans;
// as never: Body has the challan fields optional (other types don't send them); this form always does.
const api: DocApi = {
  get: (id) => call(dc[":id"].$get({ param: { id } })),
  create: (json) => call(dc.$post({ json: json as never })),
  update: (id, json) => call(dc[":id"].$put({ param: { id }, json: json as never })),
  move: (id, status) => call(dc[":id"].status.$post({ param: { id }, json: { status: status as "finalized" } })),
  draftFrom: (from) => call(dc.new.$get({ query: { from } })),
};

export function ChallanForm() {
  return (
    <DocumentForm
      type="challan"
      label="challan"
      plural="challans"
      listPath="/sales/challans"
      api={api}
      partyLabel="Customer"
      partyKind="customer"
      side="sale"
      statuses={CHALLAN_STATUS}
      moves={CHALLAN_MOVES}
      moveLabels={{ finalized: "Issue challan", cancelled: "Cancel challan" }}
      refLabels={{ ref: "Customer PO no.", date: "PO date" }}
      shipTo
      challanTypes={CHALLAN_TYPES}
      writers={WRITERS}
      printPath={(id) => `/print/challans/${id}`}
    />
  );
}
