// Sales → Challans (FR-4.3): delivery challans with their type and vehicle.
import { call, client } from "../../api.ts";
import { DocumentList, type StatusInfo } from "../../components/DocumentList.tsx";

export const CHALLAN_STATUS: StatusInfo = {
  draft: { label: "Draft", badge: "neutral" },
  finalized: { label: "Issued", badge: "informative" },
  cancelled: { label: "Cancelled", badge: "negative" },
};
export const CHALLAN_TYPES: Record<string, string> = { sale: "Sale", job_work: "Job work", approval: "Supply on approval", returnable: "Returnable" };
export const WRITERS = ["admin", "accountant", "operator"]; // the floor makes challans

export function ChallanList() {
  return (
    <DocumentList
      title="Delivery challans"
      noun="challans"
      basePath="/sales/challans"
      newLabel="New challan"
      statuses={CHALLAN_STATUS}
      writers={WRITERS}
      load={async (query) => {
        const r = await call(client.api.challans.$get({ query }));
        return { total: r.total, rows: r.challans };
      }}
      columns={[
        { label: "Type", cell: (r) => (r.challan_type ? CHALLAN_TYPES[r.challan_type] : "") },
        { label: "Vehicle", cell: (r) => r.vehicle_no ?? "" },
      ]}
    />
  );
}
