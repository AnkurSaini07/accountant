// /print/credit-notes/:id: a credit note with what CGST Rule 53 asks for (supplier and recipient
// GSTINs, its own number and date, the invoice it's against with its date, HSN, taxable value, tax,
// signature), issued in duplicate.
import { call, client } from "../../api.ts";
import { PrintPage } from "../../print/PrintPage.tsx";

export const CREDIT_NOTE_COPIES = ["Original for Recipient", "Duplicate for Supplier"];

export function CreditNotePrint() {
  return (
    <PrintPage
      load={(id) => call(client.api["credit-notes"][":id"].$get({ param: { id } }))}
      label="credit note"
      back={(id) => `/sales/credit-notes/${id}`}
      title={() => "Credit Note"}
      copies={CREDIT_NOTE_COPIES}
      refLabel="Against invoice"
      refDateLabel="Invoice date"
    />
  );
}
