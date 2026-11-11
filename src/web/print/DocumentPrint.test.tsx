import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "bun:test";
import { COMPANY } from "../test/fake-api.ts";
import { DocumentPrint, type PrintDocument } from "./DocumentPrint.tsx";
import { hsnRows } from "./HsnSummary.tsx";

const company = {
  ...COMPANY,
  legal_name: "Sunrise Fasteners Pvt Ltd",
  trade_name: "Sunrise Fasteners",
  gstin: "06AAACS1111A1Z1",
  pan: "AAACS1111A",
  phone: "0129 400 0000",
  logo: "data:image/png;base64,iVBORw0KGgo=",
  terms: "Goods once sold will not be taken back.",
  bank_accounts: [
    { bank_name: "Old Bank", account_name: null, account_number: "111", ifsc: "OLDB0000001", branch: null, is_default: false },
    { bank_name: "HDFC Bank", account_name: null, account_number: "50200012345678", ifsc: "HDFC0001234", branch: "Sector 16, Faridabad", is_default: true },
  ],
};
const line = (position: number, extra = {}) => ({
  id: position, position, item_id: 1, item_code: "FG-101", item_name: "Hex Bolt M10 x 50", description: "", hsn: "73181500", unit: "NOS", unit_decimals: 0,
  qty: 1000, rejected_qty: 0, rate: 12_50, discount_bp: 0, gst_rate: 18, taxable: 12_500_00, cgst: 1_125_00, sgst: 1_125_00, igst: 0, from_line_id: null, pending: 0, ...extra,
});
const doc = (extra: Partial<PrintDocument> = {}): PrintDocument => ({
  id: 9, type: "quotation", fy: 2026, number: "QTN/26-27/0009", date: "2026-11-11", status: "sent", party_id: 3, party_name: "Acme Castings Pvt Ltd",
  party_gstin: "06AAACA1234B1ZM", party_state_code: "06", place_of_supply: "06", reverse_charge: false,
  billing_address: { label: null, address: "Plot 4, Sector 24", city: "Faridabad", pincode: "121004", state_code: "06" },
  shipping_address: { label: "Works", address: "Plot 88, IMT", city: "Faridabad", pincode: "121003", state_code: "06" },
  party_ref: "ENQ-77", party_ref_date: "2026-11-05", due_date: "2026-11-25", challan_type: null, vehicle_no: null, transporter: null, eway_bill_no: null,
  lines: [line(1, { description: "Zinc plated" }), line(2, { item_name: "Flange Plate 6 inch", hsn: "73079990", qty: 40, rate: 845_00, discount_bp: 500, taxable: 32_110_00, cgst: 2_889_90, sgst: 2_889_90 })],
  taxable_total: 44_610_00, cgst_total: 4_014_90, sgst_total: 4_014_90, igst_total: 0, round_off: 20, grand_total: 52_640_00,
  notes: "", terms: "", created_by: 1, created_at: "", updated_at: "",
  ...extra,
} as PrintDocument);

const show = (d = doc(), props = {}) => render(<DocumentPrint doc={d} company={company} title="Quotation" dueLabel="Valid until" refLabel="Your enquiry" {...props} />);

describe("DocumentPrint", () => {
  test("letterhead, parties, details, lines, totals in words, bank, terms and signature", () => {
    show();
    const sheet = screen.getByRole("article", { name: "Quotation QTN/26-27/0009" });
    expect(within(sheet).getByRole("heading", { level: 1 })).toHaveTextContent("Sunrise Fasteners");
    expect(sheet).toHaveTextContent("Sunrise Fasteners Pvt Ltd");
    expect(sheet).toHaveTextContent("Plot 12, Sector 24, Faridabad, 121005");
    expect(sheet).toHaveTextContent("GSTIN 06AAACS1111A1Z1 · PAN AAACS1111A");
    expect(screen.getByRole("img", { name: "Sunrise Fasteners Pvt Ltd logo" })).toHaveAttribute("src", company.logo);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Quotation");

    expect(screen.getByLabelText("Bill to")).toHaveTextContent(/Acme Castings Pvt Ltd.*Plot 4, Sector 24.*Faridabad – 121004.*Haryana \(06\).*GSTIN 06AAACA1234B1ZM/);
    expect(screen.getByLabelText("Ship to")).toHaveTextContent(/Plot 88, IMT.*121003/);
    expect(screen.getByLabelText("Details")).toHaveTextContent(
      /Quotation no\.QTN\/26-27\/0009.*Date11 Nov 2026.*Valid until25 Nov 2026.*Your enquiryENQ-77 dt\. 05 Nov 2026.*Place of supplyHaryana \(06\)/,
    );
    expect(screen.getByLabelText("Details")).not.toHaveTextContent("Reverse charge");

    const rows = within(screen.getByRole("table", { name: "Lines" })).getAllByRole("row");
    expect(rows[0]!.closest("thead")).not.toBeNull(); // the header row the browser repeats on each page
    expect(rows[1]).toHaveTextContent(/1Hex Bolt M10 x 50Zinc plated73181500.*1000NOS12\.501812,500\.00/);
    expect(rows[2]).toHaveTextContent(/2Flange Plate 6 inch73079990.*40NOS845\.0051832,110\.00/);

    expect(screen.getByLabelText("Totals")).toHaveTextContent("Taxable value44,610.00CGST4,014.90SGST4,014.90Round off0.20Total₹52,640.00");
    expect(screen.getByText("Rupees Fifty Two Thousand Six Hundred Forty Only")).toBeInTheDocument();
    expect(screen.getByLabelText("Bank details")).toHaveTextContent("HDFC Bank, Sector 16, FaridabadA/c 50200012345678 · IFSC HDFC0001234"); // the default account
    expect(screen.getByLabelText("Terms")).toHaveTextContent("Goods once sold will not be taken back."); // the company's, when the document has none
    expect(screen.queryByLabelText("Notes")).not.toBeInTheDocument();
    expect(sheet).toHaveTextContent("For Sunrise Fasteners Pvt Ltd");
    expect(sheet).toHaveTextContent("Authorised Signatory");
  });

  test("HSN summary: one row per HSN and rate, with a total row", () => {
    show(doc({ lines: [line(1), line(2, { qty: 500, taxable: 6_250_00, cgst: 562_50, sgst: 562_50 }), line(3, { hsn: "73079990", gst_rate: 12, taxable: 1_000_00, cgst: 60_00, sgst: 60_00 })] }));
    const rows = within(screen.getByRole("table", { name: "HSN/SAC summary" })).getAllByRole("row");
    expect(rows.map((r) => r.textContent)).toEqual([
      "HSN/SACTaxable valueRateCGSTSGSTTotal tax",
      "730799901,000.0012%60.0060.00120.00",
      "7318150018,750.0018%1,687.501,687.503,375.00",
      "Total19,750.001,747.501,747.503,495.00",
    ]);
  });

  test("inter-state: IGST only; a Chandigarh supply says UTGST", () => {
    show(doc({ place_of_supply: "07", igst_total: 8_029_80, cgst_total: 0, sgst_total: 0, round_off: 0, lines: [line(1, { cgst: 0, sgst: 0, igst: 2_250_00 })] }));
    expect(screen.getByLabelText("Totals")).toHaveTextContent(/IGST8,029\.80/);
    expect(screen.getByLabelText("Totals")).not.toHaveTextContent("CGST");
    expect(screen.getByLabelText("Totals")).not.toHaveTextContent("Round off");
    expect(within(screen.getByRole("table", { name: "HSN/SAC summary" })).getAllByRole("columnheader").map((c) => c.textContent)).toContain("IGST");
    cleanup();
    show(doc({ place_of_supply: "04", party_state_code: "04" }));
    expect(screen.getByLabelText("Totals")).toHaveTextContent("UTGST4,014.90");
  });

  test("drafts say so; reverse charge, notes, copy label and toolbar show when given", () => {
    show(doc({ status: "draft", number: null, reverse_charge: true, notes: "Rates firm for 15 days.", terms: "Ex-works." }), { copy: "Original for Recipient", toolbar: <button type="button">Print</button> });
    expect(screen.getByRole("article", { name: "Quotation draft" })).toHaveTextContent("Draft – not issued");
    expect(screen.getByLabelText("Details")).toHaveTextContent("Quotation no.Draft");
    expect(screen.getByLabelText("Details")).toHaveTextContent("Reverse chargeYes");
    expect(screen.getByLabelText("Notes")).toHaveTextContent("Rates firm for 15 days.");
    expect(screen.getByLabelText("Terms")).toHaveTextContent("Ex-works."); // the document's own terms win
    expect(screen.getByText("Original for Recipient")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print" }).closest(".dp-toolbar")).not.toBeNull(); // hidden by print.css
  });

  test("a long document stays one table, so it runs across pages with its header repeated", () => {
    show(doc({ lines: Array.from({ length: 80 }, (_, i) => line(i + 1)) }));
    const table = screen.getByRole("table", { name: "Lines" });
    expect(within(table).getAllByRole("row")).toHaveLength(81);
    expect(table.querySelectorAll("thead")).toHaveLength(1);
  });

  test("print.css: A4, no toolbar or app chrome, header row repeats, rows don't split", async () => {
    const css = (await Bun.file(new URL("./print.css", import.meta.url)).text()).replace(/\s+/g, " ");
    expect(css).toContain("@page { size: A4;");
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toContain(".dp-toolbar { display: none; }");
    expect(print).toContain("body > :not(#root), [data-print-hide] { display: none !important; }");
    expect(print).toContain(".dp-lines thead { display: table-header-group; }");
    expect(print).toContain(".dp-table tr, .dp-sums, .dp-footer, .dp-hsn { break-inside: avoid; }");
  });

  test("hsnRows sorts by HSN then rate and treats a missing HSN as blank", () => {
    expect(hsnRows([line(3, { taxable: 3 }), line(1, { hsn: null, taxable: 1, cgst: 0, sgst: 0 }), line(2, { gst_rate: "5.00", taxable: 2 })]).map((r) => [r.hsn, r.rate, r.taxable])).toEqual([
      ["", 18, 1],
      ["73181500", 5, 2],
      ["73181500", 18, 3],
    ]);
  });
});
