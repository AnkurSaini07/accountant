// Sales → Credit notes (FR-4.6): made from a finalized invoice (its Create credit note), so no New
// button here; the reason and the invoice it's against show in the list.
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { call, client } from "../../api.ts";
import { DocumentList } from "../../components/DocumentList.tsx";
import { INVOICE_STATUS } from "./InvoiceList.tsx";

export const NOTE_REASONS: Record<string, string> = { return: "Goods returned", rate_difference: "Rate difference" };

export function CreditNoteList() {
  return (
    <DocumentList
      title="Credit notes"
      noun="credit notes"
      basePath="/sales/credit-notes"
      statuses={INVOICE_STATUS}
      actions={<span className={style({ font: "body-sm", color: "gray-700", alignSelf: "center" })}>Make one from a finalized invoice: open it and choose Create credit note.</span>}
      load={async (query) => {
        const r = await call(client.api["credit-notes"].$get({ query }));
        return { total: r.total, rows: r.credit_notes };
      }}
      columns={[
        { label: "Reason", cell: (r) => NOTE_REASONS[r.note_reason ?? ""] ?? "" },
        { label: "Against invoice", cell: (r) => r.party_ref ?? "" },
      ]}
    />
  );
}
