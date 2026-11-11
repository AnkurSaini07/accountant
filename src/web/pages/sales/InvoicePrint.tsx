// /print/invoices/:id: a tax invoice with everything CGST Rule 46 asks for (supplier and recipient
// with GSTINs, number and date, place of supply with its state, ship-to, HSN, description, qty and
// unit, taxable value after discount, GST rate and amount per HSN, reverse charge, total in figures
// and words, signature), issued in triplicate for goods (Rule 48).
import { call, client } from "../../api.ts";
import { PrintPage } from "../../print/PrintPage.tsx";

export const INVOICE_COPIES = ["Original for Recipient", "Duplicate for Transporter", "Triplicate for Supplier"]; // Rule 48(1)

export function InvoicePrint() {
  return (
    <PrintPage
      load={(id) => call(client.api.invoices[":id"].$get({ param: { id } }))}
      label="invoice"
      back={(id) => `/sales/invoices/${id}`}
      title={() => "Tax Invoice"}
      copies={INVOICE_COPIES}
      refLabel="Customer PO"
      dueLabel="Payment due"
    />
  );
}
