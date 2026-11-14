import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { Shell } from "../../Shell.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";

const QUOTATION = {
  id: 9, type: "quotation", fy: 2026, number: "QTN/26-27/0009", date: "2026-11-11", status: "sent", party_id: 3, party_name: "Acme Castings Pvt Ltd", party_gstin: null, party_state_code: "06",
  billing_address: null, shipping_address: null, place_of_supply: "06", reverse_charge: false, party_ref: null, party_ref_date: null, due_date: "2026-11-25",
  challan_type: null, vehicle_no: null, transporter: null, eway_bill_no: null,
  lines: [{ id: 11, position: 1, item_id: 1, item_code: "FG-101", item_name: "Hex Bolt M10 x 50", description: "", hsn: "73181500", unit: "NOS", unit_decimals: 0, qty: 1000, rate: 12_50, discount_bp: 0, gst_rate: 18, taxable: 12_500_00, cgst: 1_125_00, sgst: 1_125_00, igst: 0 }],
  taxable_total: 12_500_00, cgst_total: 1_125_00, sgst_total: 1_125_00, igst_total: 0, round_off: 0, grand_total: 14_750_00,
  notes: "", terms: "", created_by: 1, created_at: "", updated_at: "u1",
};
const realPrint = window.print;
afterEach(() => {
  window.print = realPrint;
});

async function open(url: string) {
  fakeApi({ "GET /auth/me": ME, "GET /company": COMPANY, "GET /quotations/9": QUOTATION, "GET /quotations/404": Response.json({ error: { code: "NOT_FOUND", message: "No such quotation." } }, { status: 404 }) });
  render(
    <MemoryRouter initialEntries={[url]}>
      <Shell />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe("Sales → Quotations → print", () => {
  test("the quotation on its own A4 sheet: no app layout, quotation title and validity, named for Save as PDF", async () => {
    let printed = 0;
    window.print = () => void printed++;
    const user = await open("/print/quotations/9");
    const sheet = await screen.findByRole("article", { name: "Quotation QTN/26-27/0009" });
    expect(screen.queryByRole("navigation", { name: "Sections" })).not.toBeInTheDocument(); // no side nav or header
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Quotation");
    expect(screen.getByLabelText("Details")).toHaveTextContent("Valid until25 Nov 2026");
    expect(sheet).toHaveTextContent("Rupees Fourteen Thousand Seven Hundred Fifty Only");
    await waitFor(() => expect(document.title).toBe("Quotation QTN/26-27/0009 – Acme Castings Pvt Ltd"));
    await user.click(screen.getByRole("button", { name: "Print or save as PDF" }));
    expect(printed).toBe(1);
    expect(screen.getByRole("link", { name: "Back to quotation" })).toHaveAttribute("href", "/sales/quotations/9");
  });

  test("a quotation that can't be loaded says so, with the way back", async () => {
    await open("/print/quotations/404");
    expect(await screen.findByText(/This quotation couldn't be loaded/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to quotation" })).toBeInTheDocument();
  });

  test("the quotation form links to its print", async () => {
    await open("/sales/quotations/9");
    await waitFor(() => expect(screen.getByRole("link", { name: "Print" })).toHaveAttribute("href", "/print/quotations/9"));
  });
});
