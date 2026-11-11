import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { Shell } from "../../App.tsx";
import { PAGE_SIZE } from "../../components/ListUrl.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";

const line = (id: number, extra = {}) => ({
  id, position: id, item_id: 1, item_code: "FG-101", item_name: "Hex Bolt M10 x 50", description: "", hsn: "73181500", unit: "NOS", unit_decimals: 0,
  qty: 1000, rate: 12_50, discount_bp: 0, gst_rate: 18, taxable: 12_500_00, cgst: 1_125_00, sgst: 1_125_00, igst: 0, from_line_id: null, pending: 1000, ...extra,
});
const doc = (type: string, status: string, extra = {}) => ({
  id: 9, type, fy: 2026, number: type === "quotation" ? "QTN/26-27/0009" : "SO/26-27/0004", date: "2026-11-11", status, party_id: 3, party_name: "Acme Castings Pvt Ltd",
  party_gstin: "06AAACA1234B1ZM", party_state_code: "06", billing_address: { label: null, address: "", city: "Faridabad", pincode: null, state_code: "06" },
  shipping_address: null, place_of_supply: "06", reverse_charge: false, party_ref: null, party_ref_date: null, due_date: null,
  challan_type: null, vehicle_no: null, transporter: null, eway_bill_no: null, lines: [line(1)],
  taxable_total: 12_500_00, cgst_total: 1_125_00, sgst_total: 1_125_00, igst_total: 0, round_off: 0, grand_total: 14_750_00,
  notes: "", terms: "", created_by: 1, created_at: "", updated_at: `u-${status}`, ...extra,
});
const listRow = (id: number, number: string, status: string, ordered: number, pending: number, party_ref: string | null = null) =>
  ({ id, number, date: "2026-11-11", status, party_id: 3, party_name: "Acme Castings Pvt Ltd", due_date: null, party_ref, grand_total: 14_750_00, ordered_qty: ordered, pending_qty: pending });
const DRAFT_FROM = {
  type: "sales_order", date: "2026-11-11", party_id: 3, party: { id: 3, name: "Acme Castings Pvt Ltd", gstin: "06AAACA1234B1ZM", city: "Faridabad", state_code: "06" },
  shipping_address: null, place_of_supply: null, reverse_charge: false, party_ref: null, party_ref_date: null, due_date: null, challan_type: null, vehicle_no: null, transporter: null, eway_bill_no: null,
  notes: "", terms: "", lines: [{ item_id: 1, description: "", qty: 400, rate: 12_50, discount_bp: 0, gst_rate: 18, from_line_id: 77, item_code: "FG-101", item_name: "Hex Bolt M10 x 50", hsn: "73181500", unit: "NOS", unit_decimals: 0 }],
};

const ACME_PARTY = {
  id: 3, name: "Acme Castings Pvt Ltd", kind: "customer", registration_type: "regular", gstin: "06AAACA1234B1ZM", pan: null, state_code: "06", contact_person: null, phone: null, email: null,
  credit_days: 0, credit_limit: 0, opening_balance: 0, active: true, updated_at: "",
  addresses: [
    { id: 1, kind: "billing", label: null, address: "Plot 4, Sector 24", city: "Faridabad", pincode: "121004", state_code: "06" },
    { id: 2, kind: "shipping", label: "Okhla site", address: "B-12, Okhla Phase 2", city: "New Delhi", pincode: "110020", state_code: "07" },
  ],
};
const INVOICE_DRAFT = { ...DRAFT_FROM, type: "invoice" };
const invoiceRow = (id: number, number: string, status: string, due_date: string | null, party_ref: string | null = null) => ({ ...listRow(id, number, status, 1000, 1000, party_ref), due_date, challan_type: null, vehicle_no: null });
const inv = (status: string, extra = {}) => doc("invoice", status, { number: "INV/26-27/0009", ...extra });

type Sent = { method: string; path: string; search: string; body: unknown };
async function open(url: string, routes: Record<string, unknown> = {}, role = ME.role as string) {
  const sent: Sent[] = [];
  const record = (result: unknown) => async (req: Request) => {
    const u = new URL(req.url);
    sent.push({ method: req.method, path: u.pathname, search: u.search, body: req.method === "GET" ? null : await req.json() });
    return result;
  };
  fakeApi({
    "GET /auth/me": { ...ME, role },
    "GET /company": COMPANY,
    "GET /parties/3": ACME_PARTY,
    "GET /invoices": record({ total: 2, page: 1, page_size: PAGE_SIZE, invoices: [invoiceRow(2, "INV/26-27/0002", "finalized", "2026-12-11", "ACME/PO/4471"), invoiceRow(1, "INV/26-27/0001", "draft", null)] }),
    "GET /invoices/new": INVOICE_DRAFT,
    "GET /invoices/9": inv("draft"),
    "GET /challans/9": doc("challan", "finalized", { number: "DC/26-27/0009", challan_type: "sale" }),
    "POST /invoices": record(inv("draft")),
    "PUT /invoices/9": record(inv("draft")),
    "POST /invoices/9/status": record(inv("finalized")),
    "POST /invoices/9/cancel": record(inv("cancelled", { cancel_reason: "Wrong rate; reissued", cancelled_at: "2026-11-12T10:00:00Z" })),
    ...Object.fromEntries(Object.entries(routes).map(([k, v]) => [k, k.startsWith("GET") ? v : record(v)])),
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <Shell />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1 });
  return { user: userEvent.setup(), sent };
}
const box = (name: string | RegExp) => screen.getByRole("textbox", { name });
/** An S2 Picker's button is named "<selected value> <label>", plus " (required)" when it is. */
const picker = (label: string) => screen.getByRole("button", { name: new RegExp(`${label}( \\(required\\))?$`) });
const rowWith = (text: string) => screen.getAllByRole("row").find((r) => r.textContent?.includes(text))!;
const totals = () => within(screen.getByLabelText("Totals"));

describe("Sales → Invoices", () => {
  test("list: customer PO and payment due; date range filter; a backwards range isn't sent", async () => {
    const { sent } = await open("/sales/invoices?date_from=2026-11-01&date_to=2026-11-30");
    await screen.findByText("INV/26-27/0002");
    expect(rowWith("INV/26-27/0002")).toHaveTextContent(/ACME\/PO\/4471.*11 Dec 2026.*Finalized/);
    expect(screen.getByRole("link", { name: "Invoices" })).toHaveAttribute("aria-current", "page");
    expect(sent.at(-1)!.search).toContain("from=2026-11-01&to=2026-11-30");
    cleanup();
    const back = await open("/sales/invoices?date_from=2026-11-30&date_to=2026-11-01");
    expect(await screen.findByText("Pick a date on or after From.")).toBeInTheDocument();
    expect(back.sent).toEqual([]);
    expect(screen.getByText("No invoices match. Try another search, status or dates.")).toBeInTheDocument();
  });

  test("an issued challan offers Create invoice; shipping to Delhi turns CGST + SGST into IGST live; the save carries it all", async () => {
    await open("/sales/challans/9");
    expect(screen.getByRole("link", { name: "Create invoice" })).toHaveAttribute("href", "/sales/invoices/new?from=9");
    cleanup();
    const { user, sent } = await open("/sales/invoices/new?from=9");
    expect(screen.getByText(/^Made from 1 pending line/)).toBeInTheDocument();
    expect(totals().getByText("CGST")).toBeInTheDocument();
    await user.click(await waitFor(() => picker("Ship to")));
    await user.click(await screen.findByRole("option", { name: /Okhla site/ }));
    await waitFor(() => expect(totals().getByText("IGST")).toBeInTheDocument());
    expect(totals().queryByText("CGST")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Reverse charge/ }));
    await user.type(box("E-way bill no."), "331000123456");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent.filter((s) => s.method === "POST")).toHaveLength(1));
    expect(sent.find((s) => s.method === "POST")).toMatchObject({
      path: "/api/invoices",
      body: { party_id: 3, reverse_charge: true, eway_bill_no: "331000123456", vehicle_no: null, shipping_address: { label: "Okhla site", state_code: "07" }, lines: [{ item_id: 1, qty: 400, from_line_id: 77 }] },
    });
    expect((sent.find((s) => s.method === "POST")!.body as Record<string, unknown>).challan_type).toBeUndefined(); // invoices have no challan type
  });

  test("Finalize asks first, saves the draft, then the invoice is read-only", async () => {
    const { user, sent } = await open("/sales/invoices/9");
    await user.click(screen.getByRole("button", { name: "Finalize invoice" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Mark invoice INV/26-27/0009 as finalized?" });
    expect(sent.filter((s) => s.method !== "GET")).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: "Finalize invoice" }));
    expect(await screen.findByText("This invoice is finalized, so it can't be edited.")).toBeInTheDocument();
    expect(sent.filter((s) => s.method !== "GET").map((s) => `${s.method} ${s.path}`)).toEqual(["PUT /api/invoices/9", "POST /api/invoices/9/status"]);
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  test("an admin cancels a finalized invoice with a reason; it says why afterwards", async () => {
    const { user, sent } = await open("/sales/invoices/9", { "GET /invoices/9": inv("finalized") }, "admin");
    await user.click(screen.getByRole("button", { name: "Cancel invoice" }));
    const dialog = within(await screen.findByRole("dialog"));
    const go = dialog.getByRole("button", { name: "Cancel it" });
    expect(go).toBeDisabled(); // no reason yet
    await user.type(dialog.getByRole("textbox", { name: /Reason/ }), "Wrong rate; reissued");
    await waitFor(() => expect(go).toBeEnabled());
    await user.click(go);
    expect(await screen.findByText("Cancelled on 12 Nov 2026: Wrong rate; reissued. Its number stays used.")).toBeInTheDocument();
    expect(sent.filter((s) => s.method !== "GET")).toEqual([{ method: "POST", path: "/api/invoices/9/cancel", search: "", body: { reason: "Wrong rate; reissued" } }]);
    expect(screen.queryByRole("button", { name: "Cancel invoice" })).not.toBeInTheDocument();
  });

  test("a confirmed order can be invoiced straight away; a draft challan can't be yet", async () => {
    await open("/sales/orders/9", { "GET /sales-orders/9": doc("sales_order", "finalized") });
    expect(screen.getByRole("link", { name: "Create invoice" })).toHaveAttribute("href", "/sales/invoices/new?from=9");
    cleanup();
    await open("/sales/challans/9", { "GET /challans/9": doc("challan", "draft", { number: "DC/26-27/0009", challan_type: "sale" }) });
    expect(screen.getByRole("button", { name: "Issue challan" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create invoice" })).not.toBeInTheDocument();
  });

  test("only admins cancel; viewers can't make invoices or create them from challans", async () => {
    await open("/sales/invoices/9", { "GET /invoices/9": inv("finalized") }, "accountant");
    expect(screen.queryByRole("button", { name: "Cancel invoice" })).not.toBeInTheDocument();
    cleanup();
    await open("/sales/challans/9", {}, "viewer");
    expect(screen.queryByRole("link", { name: "Create invoice" })).not.toBeInTheDocument();
    cleanup();
    await open("/sales/invoices", {}, "viewer");
    expect(screen.queryByRole("link", { name: "New invoice" })).not.toBeInTheDocument();
  });
});
