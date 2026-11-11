// Sales → Quotations (FR-4.1).
import { call, client } from "../../api.ts";
import { DocumentList, formatDate, type StatusInfo } from "../../components/DocumentList.tsx";

export const QUOTATION_STATUS: StatusInfo = {
  draft: { label: "Draft", badge: "neutral" },
  sent: { label: "Sent", badge: "informative" },
  accepted: { label: "Accepted", badge: "positive" },
  rejected: { label: "Rejected", badge: "negative" },
  expired: { label: "Expired", badge: "notice" },
};

export function QuotationList() {
  return (
    <DocumentList
      title="Quotations"
      noun="quotations"
      basePath="/sales/quotations"
      newLabel="New quotation"
      statuses={QUOTATION_STATUS}
      load={async (query) => {
        const r = await call(client.api.quotations.$get({ query }));
        return { total: r.total, rows: r.quotations };
      }}
      columns={[{ label: "Valid until", cell: (r) => (r.due_date ? formatDate(r.due_date) : "") }]}
    />
  );
}
