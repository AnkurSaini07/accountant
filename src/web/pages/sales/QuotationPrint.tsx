// /print/quotations/:id: the quotation on an A4 sheet.
import { call, client } from "../../api.ts";
import { PrintPage } from "../../print/PrintPage.tsx";

export function QuotationPrint() {
  return (
    <PrintPage
      load={(id) => call(client.api.quotations[":id"].$get({ param: { id } }))}
      label="quotation"
      back={(id) => `/sales/quotations/${id}`}
      title={() => "Quotation"}
      dueLabel="Valid until"
      refLabel="Your enquiry"
    />
  );
}
