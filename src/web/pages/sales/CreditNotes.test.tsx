import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { Shell } from "../../Shell.tsx";
import { PAGE_SIZE } from "../../components/ListUrl.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";
import { pick, picker } from "../../test/select.ts";

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
// A credit note made from finalized invoice INV/26-27/0009 (9): taxed in Delhi as the invoice was.
const OKHLA = { label: "Okhla site", address: "B-12, Okhla Phase 2", city: "New Delhi", pincode: "110020", state_code: "07" };
const NOTE_DRAFT = { ...DRAFT_FROM, type: "credit_note", note_reason: "return", shipping_address: OKHLA, place_of_supply: "07", party_ref: "INV/26-27/0009", party_ref_date: "2026-11-11" };
const note = (status: string, extra = {}) => doc("credit_note", status, { id: 5, number: "CN/26-27/0005", note_reason: "return", party_ref: "INV/26-27/0009", party_ref_date: "2026-11-11", ...extra });
const noteRow = (id: number, number: string, status: string, note_reason: string) => ({ ...listRow(id, number, status, 0, 0, "INV/26-27/0009"), challan_type: null, vehicle_no: null, note_reason });

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
    "GET /credit-notes": { total: 2, page: 1, page_size: PAGE_SIZE, credit_notes: [noteRow(6, "CN/26-27/0006", "draft", "rate_difference"), noteRow(5, "CN/26-27/0005", "finalized", "return")] },
    "GET /credit-notes/new": NOTE_DRAFT,
    "GET /credit-notes/5": note("draft"),
    "GET /invoices/9": doc("invoice", "finalized", { number: "INV/26-27/0009" }),
    "POST /credit-notes": record(note("draft")),
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
const rowWith = (text: string) => screen.getAllByRole("row").find((r) => r.textContent?.includes(text))!;
const totals = () => within(screen.getByLabelText("Totals"));

describe("Sales → Credit notes", () => {
  test("list: reason and the invoice it's against; no New button (they come from invoices)", async () => {
    await open("/sales/credit-notes");
    await screen.findByText("CN/26-27/0005");
    expect(rowWith("CN/26-27/0005")).toHaveTextContent(/Goods returned.*INV\/26-27\/0009.*Finalized/);
    expect(rowWith("CN/26-27/0006")).toHaveTextContent("Rate difference");
    expect(screen.getByRole("link", { name: "Credit notes" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).not.toContain("/sales/credit-notes/new");
    expect(screen.getByText(/Make one from a finalized invoice/)).toBeInTheDocument();
  });

  test("a finalized invoice offers Create credit note; a bare /new goes back to the list", async () => {
    await open("/sales/invoices/9");
    expect(screen.getByRole("link", { name: "Create credit note" })).toHaveAttribute("href", "/sales/credit-notes/new?from=9");
    cleanup();
    await open("/sales/invoices/9", { "GET /invoices/9": doc("invoice", "draft", { number: "INV/26-27/0009" }) });
    expect(screen.getByRole("button", { name: "Finalize invoice" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create credit note" })).not.toBeInTheDocument(); // not before it's finalized
    cleanup();
    await open("/sales/credit-notes/new");
    expect(await screen.findByRole("heading", { level: 1, name: "Credit notes" })).toBeInTheDocument();
  });

  test("from the invoice: its ship-to (IGST to Delhi), its number quoted; a rate difference saves with its reason", async () => {
    const { user, sent } = await open("/sales/credit-notes/new?from=9");
    expect(box("Against invoice")).toHaveValue("INV/26-27/0009");
    expect(picker("Reason")).toHaveDisplayValue("Goods returned");
    await waitFor(() => expect(totals().getByText("IGST")).toBeInTheDocument()); // taxed as the invoice was
    await pick(user, "Reason", "Rate difference");
    const rate = screen.getByRole("textbox", { name: "Rate, line 1" });
    await user.clear(rate);
    await user.type(rate, "2.50");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent.filter((s) => s.method === "POST")).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      path: "/api/credit-notes",
      body: { note_reason: "rate_difference", party_ref: "INV/26-27/0009", shipping_address: { state_code: "07" }, lines: [{ qty: 400, rate: 2_50, from_line_id: 77 }] },
    });
  });

  test("the reason is required", async () => {
    const { user, sent } = await open("/sales/credit-notes/new?from=9", { "GET /credit-notes/new": { ...NOTE_DRAFT, note_reason: null } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(picker("Reason")).toHaveFocus());
    expect(sent).toEqual([]);
  });

  test("finalized: read-only, printable, admins can cancel it", async () => {
    const { user } = await open("/sales/credit-notes/5", { "GET /credit-notes/5": note("finalized") }, "admin");
    expect(screen.getByText("This credit note is finalized, so it can't be edited.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Print/ })).toHaveAttribute("href", "/print/credit-notes/5");
    expect(screen.queryByRole("button", { name: "Reason" })).toBeNull(); // a document view, not a locked form
    expect(within(screen.getByRole("region", { name: /^Credit note/ })).getByText("Reason")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(await screen.findByRole("menuitem", { name: "Cancel credit note…" })).toBeInTheDocument();
  });
});

describe("Sales → Credit notes → print", () => {
  test("Credit Note, against its invoice, in duplicate", async () => {
    fakeApi({ "GET /auth/me": ME, "GET /company": COMPANY, "GET /credit-notes/5": note("finalized") });
    render(
      <MemoryRouter initialEntries={["/print/credit-notes/5"]}>
        <Shell />
      </MemoryRouter>,
    );
    const sheet = await screen.findByRole("article", { name: "Credit Note CN/26-27/0005" });
    expect(screen.getByLabelText("Details")).toHaveTextContent("Credit Note no.CN/26-27/0005Date11 Nov 2026Against invoiceINV/26-27/0009Invoice date11 Nov 2026");
    expect(sheet).toHaveTextContent("Original for Recipient");
    expect([...picker("Copy").options].map((o) => o.textContent)).toEqual(["Original for Recipient", "Duplicate for Supplier"]);
  });
});
