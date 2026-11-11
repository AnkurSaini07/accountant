// /print/challans/:id: a delivery challan with everything CGST Rule 55 asks for (number and date,
// consignor and consignee with GSTINs, HSN, description, qty, taxable value, tax, place of supply,
// signature), titled by its type and issued in triplicate.
import { call, client } from "../../api.ts";
import { PrintPage } from "../../print/PrintPage.tsx";

export const CHALLAN_TITLES: Record<string, string> = {
  sale: "Delivery Challan",
  job_work: "Job Work Challan",
  approval: "Delivery Challan – Supply on Approval",
  returnable: "Returnable Delivery Challan",
};
export const CHALLAN_COPIES = ["Original for Consignee", "Duplicate for Transporter", "Triplicate for Consigner"]; // Rule 55(2)

export function ChallanPrint() {
  return (
    <PrintPage
      load={(id) => call(client.api.challans[":id"].$get({ param: { id } }))}
      label="challan"
      back={(id) => `/sales/challans/${id}`}
      title={(d) => CHALLAN_TITLES[d.challan_type ?? "sale"]!}
      copies={CHALLAN_COPIES}
      partyLabel="Consignee"
      refLabel="Customer PO"
    />
  );
}
