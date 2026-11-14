import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { Shell } from "../../Shell.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";
import { pick, picker } from "../../test/select.ts";

const CHALLAN = {
  id: 9, type: "challan", fy: 2026, number: "DC/26-27/0009", date: "2026-11-11", status: "finalized", party_id: 3, party_name: "Delta Auto Components", party_gstin: "07AABCD1234E1Z5", party_state_code: "07",
  billing_address: { label: null, address: "B-12, Okhla Phase 2", city: "New Delhi", pincode: "110020", state_code: "07" },
  shipping_address: { label: "Works", address: "Plot 9, Bawana", city: "New Delhi", pincode: "110039", state_code: "07" },
  place_of_supply: "07", reverse_charge: false, party_ref: "DAC/PO/2291", party_ref_date: null, due_date: null,
  challan_type: "job_work", vehicle_no: "HR 51 AB 1234", transporter: "Faridabad Roadways", eway_bill_no: "331000123456",
  lines: [{ id: 11, position: 1, item_id: 1, item_code: "FG-101", item_name: "Hex Bolt M10 x 50", description: "For zinc plating", hsn: "73181500", unit: "NOS", unit_decimals: 0, qty: 1000, rate: 12_50, discount_bp: 0, gst_rate: 18, taxable: 12_500_00, cgst: 0, sgst: 0, igst: 2_250_00 }],
  taxable_total: 12_500_00, cgst_total: 0, sgst_total: 0, igst_total: 2_250_00, round_off: 0, grand_total: 14_750_00,
  notes: "", terms: "", created_by: 1, created_at: "", updated_at: "u1",
};
async function open(challan = CHALLAN) {
  fakeApi({ "GET /auth/me": ME, "GET /company": { ...COMPANY, gstin: "06AAACS1111A1Z1" }, "GET /challans/9": challan });
  render(
    <MemoryRouter initialEntries={["/print/challans/9"]}>
      <Shell />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe("Sales → Challans → print", () => {
  test("Rule 55: titled by type, consignor and consignee GSTINs, HSN, qty, value, tax, place of supply, transport, signature", async () => {
    const user = await open();
    const sheet = await screen.findByRole("article", { name: "Job Work Challan DC/26-27/0009" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Job Work Challan");
    expect(sheet).toHaveTextContent("GSTIN 06AAACS1111A1Z1"); // consignor
    expect(screen.getByLabelText("Consignee")).toHaveTextContent("Delta Auto ComponentsB-12, Okhla Phase 2New Delhi – 110020Delhi (07)GSTIN 07AABCD1234E1Z5");
    expect(screen.getByLabelText("Ship to")).toHaveTextContent("Plot 9, Bawana");
    const details = within(screen.getByLabelText("Details"));
    expect(details.getByText("Job Work Challan no.").nextSibling).toHaveTextContent("DC/26-27/0009");
    expect(screen.getByLabelText("Details")).toHaveTextContent(/Place of supplyDelhi \(07\).*Vehicle no\.HR 51 AB 1234.*TransporterFaridabad Roadways.*E-way bill no\.331000123456/);
    expect(screen.getByLabelText("Details")).toHaveTextContent("Customer PODAC/PO/2291");
    expect(within(screen.getByRole("table", { name: "Lines" })).getAllByRole("row")[1]).toHaveTextContent(/Hex Bolt M10 x 50For zinc plating73181500\s*1000NOS/);
    expect(screen.getByLabelText("Totals")).toHaveTextContent("IGST2,250.00");
    expect(sheet).toHaveTextContent("Authorised Signatory");

    // Triplicate (Rule 55(2)): Original by default; pick the copy before printing.
    expect(sheet).toHaveTextContent("Original for Consignee");
    expect([...picker("Copy").options].map((o) => o.textContent)).toEqual(["Original for Consignee", "Duplicate for Transporter", "Triplicate for Consigner"]);
    await pick(user, "Copy", "Duplicate for Transporter");
    expect(sheet).toHaveTextContent("Duplicate for Transporter");
    await waitFor(() => expect(document.title).toBe("Challan DC/26-27/0009 – Delta Auto Components"));
    expect(screen.getByRole("link", { name: "Back to challan" })).toHaveAttribute("href", "/sales/challans/9");
  });

  test("each type has its own title", async () => {
    for (const [type, title] of [["sale", "Delivery Challan"], ["approval", "Delivery Challan – Supply on Approval"], ["returnable", "Returnable Delivery Challan"]]) {
      await open({ ...CHALLAN, challan_type: type! });
      expect(await screen.findByRole("heading", { level: 2, name: title })).toBeInTheDocument();
      cleanup();
    }
  });
});
