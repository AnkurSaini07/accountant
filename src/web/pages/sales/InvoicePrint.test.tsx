import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { Shell } from "../../App.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";

// A local sale from Faridabad (06) to Faridabad: CGST + SGST; two lines, one HSN repeated.
const INVOICE = {
  id: 9, type: "invoice", fy: 2026, number: "INV/26-27/0009", date: "2026-11-11", status: "finalized", party_id: 3, party_name: "Acme Castings Pvt Ltd", party_gstin: "06AAACA1234B1ZM", party_state_code: "06",
  billing_address: { label: null, address: "Plot 42, Sector 24", city: "Faridabad", pincode: "121005", state_code: "06" },
  shipping_address: null, place_of_supply: "06", reverse_charge: false, party_ref: "ACME/PO/4471", party_ref_date: "2026-11-02", due_date: "2026-12-11",
  challan_type: null, vehicle_no: "HR 51 AB 1234", transporter: null, eway_bill_no: "331000123456", cancel_reason: null, cancelled_at: null,
  lines: [
    { id: 11, position: 1, item_id: 1, item_code: "FG-101", item_name: "Hex Bolt M10 x 50", description: "", hsn: "73181500", unit: "NOS", unit_decimals: 0, qty: 5000, rate: 12_50, discount_bp: 0, gst_rate: 18, taxable: 62_500_00, cgst: 5_625_00, sgst: 5_625_00, igst: 0 },
    { id: 12, position: 2, item_id: 2, item_code: "FG-102", item_name: "Hex Bolt M12 x 60", description: "", hsn: "73181500", unit: "NOS", unit_decimals: 0, qty: 1000, rate: 20_00, discount_bp: 1000, gst_rate: 18, taxable: 18_000_00, cgst: 1_620_00, sgst: 1_620_00, igst: 0 },
  ],
  taxable_total: 80_500_00, cgst_total: 7_245_00, sgst_total: 7_245_00, igst_total: 0, round_off: 0, grand_total: 94_990_00,
  notes: "", terms: "", created_by: 1, created_at: "", updated_at: "u1",
};
async function open(invoice: Record<string, unknown> = INVOICE) {
  fakeApi({ "GET /auth/me": ME, "GET /company": { ...COMPANY, gstin: "06AAACS1111A1Z1" }, "GET /invoices/9": invoice });
  render(
    <MemoryRouter initialEntries={["/print/invoices/9"]}>
      <Shell />
    </MemoryRouter>,
  );
  const sheet = await screen.findByRole("article", { name: "Tax Invoice INV/26-27/0009" });
  return { user: userEvent.setup(), sheet };
}

describe("Sales → Invoices → print", () => {
  test("Rule 46: GSTINs, number and date, place of supply, HSN summary, reverse charge, amount in words, signature", async () => {
    const { sheet } = await open();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Tax Invoice");
    expect(sheet).toHaveTextContent("GSTIN 06AAACS1111A1Z1"); // supplier
    expect(screen.getByLabelText("Bill to")).toHaveTextContent("Acme Castings Pvt LtdPlot 42, Sector 24Faridabad – 121005Haryana (06)GSTIN 06AAACA1234B1ZM");
    expect(screen.getByLabelText("Ship to")).toHaveTextContent("Plot 42, Sector 24"); // same as billing
    expect(screen.getByLabelText("Details")).toHaveTextContent(
      /Tax Invoice no\.INV\/26-27\/0009Date11 Nov 2026Payment due11 Dec 2026Customer POACME\/PO\/4471 dt\. 02 Nov 2026Place of supplyHaryana \(06\)Vehicle no\.HR 51 AB 1234E-way bill no\.331000123456Reverse chargeNo/,
    );
    expect(within(screen.getByRole("table", { name: "Lines" })).getAllByRole("row")[2]).toHaveTextContent(/Hex Bolt M12 x 6073181500\s*1000NOS20\.001018\s*18,000\.00/);
    const hsn = within(screen.getByRole("table", { name: "HSN/SAC summary" })).getAllByRole("row");
    expect(hsn.find((r) => r.textContent?.startsWith("73181500"))).toHaveTextContent(/80,500\.00.*18%?.*7,245\.00.*7,245\.00/); // one row per HSN, both lines
    expect(screen.getByLabelText("Totals")).toHaveTextContent("CGST7,245.00SGST7,245.00");
    expect(sheet).toHaveTextContent("Amount in wordsRupees Ninety Four Thousand Nine Hundred Ninety Only");
    expect(sheet).toHaveTextContent("Authorised Signatory");
    expect(sheet).not.toHaveTextContent("Cancelled");
  });

  test("triplicate: Original for Recipient by default; pick the copy before printing", async () => {
    const { user, sheet } = await open();
    expect(sheet).toHaveTextContent("Original for Recipient");
    await user.click(screen.getByRole("button", { name: /Copy$/ }));
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Original for Recipient", "Duplicate for Transporter", "Triplicate for Supplier"]);
    await user.click(screen.getByRole("option", { name: "Triplicate for Supplier" }));
    expect(sheet).toHaveTextContent("Triplicate for Supplier");
    await waitFor(() => expect(document.title).toBe("Invoice INV/26-27/0009 – Acme Castings Pvt Ltd"));
    expect(screen.getByRole("link", { name: "Back to invoice" })).toHaveAttribute("href", "/sales/invoices/9");
  });

  test("reverse charge says Yes; a cancelled invoice says it isn't valid", async () => {
    const { sheet } = await open({ ...INVOICE, reverse_charge: true, status: "cancelled", cancel_reason: "Wrong rate", cancelled_at: "2026-11-12T10:00:00Z" });
    expect(screen.getByLabelText("Details")).toHaveTextContent("Reverse chargeYes");
    expect(sheet).toHaveTextContent("Cancelled – not valid");
  });
});
