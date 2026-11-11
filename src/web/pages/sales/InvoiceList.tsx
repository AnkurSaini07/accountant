// Sales → Invoices (FR-4.4): tax invoices with payment due date; status, party (search) and date filters.
import { call, client } from "../../api.ts";
import { DocumentList, formatDate, type StatusInfo } from "../../components/DocumentList.tsx";

export const INVOICE_STATUS: StatusInfo = {
  draft: { label: "Draft", badge: "neutral" },
  finalized: { label: "Finalized", badge: "positive" },
  cancelled: { label: "Cancelled", badge: "negative" },
};

export function InvoiceList() {
  return (
    <DocumentList
      title="Tax invoices"
      noun="invoices"
      basePath="/sales/invoices"
      newLabel="New invoice"
      statuses={INVOICE_STATUS}
      load={async (query) => {
        const r = await call(client.api.invoices.$get({ query }));
        return { total: r.total, rows: r.invoices };
      }}
      columns={[
        { label: "Customer PO", cell: (r) => r.party_ref ?? "" },
        { label: "Payment due", cell: (r) => (r.due_date ? formatDate(r.due_date) : "") },
      ]}
    />
  );
}
