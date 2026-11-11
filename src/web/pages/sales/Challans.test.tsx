import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
    { id: 2, kind: "shipping", label: "Plant 2", address: "Plot 88, IMT", city: "Faridabad", pincode: "121003", state_code: "06" },
  ],
};
const CHALLAN_DRAFT = { ...DRAFT_FROM, type: "challan", challan_type: "sale" };
const challanRow = (id: number, number: string, challan_type: string, vehicle_no: string | null) => ({ ...listRow(id, number, "finalized", 1000, 1000), challan_type, vehicle_no });

type Sent = { method: string; path: string; body: unknown };
async function open(url: string, routes: Record<string, unknown> = {}, role = ME.role as string) {
  const sent: Sent[] = [];
  const record = (result: unknown) => async (req: Request) => {
    sent.push({ method: req.method, path: new URL(req.url).pathname, body: await req.json() });
    return result;
  };
  fakeApi({
    "GET /auth/me": { ...ME, role },
    "GET /company": COMPANY,
    "GET /parties/3": ACME_PARTY,
    "GET /challans": { total: 2, page: 1, page_size: PAGE_SIZE, challans: [challanRow(2, "DC/26-27/0002", "job_work", "HR 51 AB 1234"), challanRow(1, "DC/26-27/0001", "sale", null)] },
    "GET /challans/new": CHALLAN_DRAFT,
    "GET /challans/9": doc("challan", "draft", { number: "DC/26-27/0009", challan_type: "returnable", vehicle_no: "HR 51 AB 1234", shipping_address: { label: "Old godown", address: "Plot 3", city: "Ballabgarh", pincode: null, state_code: "06" } }),
    "GET /sales-orders/9": doc("sales_order", "finalized"),
    "POST /challans": record(doc("challan", "draft", { challan_type: "sale" })),
    "PUT /challans/9": record(doc("challan", "draft", { challan_type: "returnable" })),
    "POST /challans/9/status": record(doc("challan", "finalized", { number: "DC/26-27/0009", challan_type: "returnable" })),
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

describe("Sales → Challans", () => {
  test("list: type and vehicle; Challans in the Sales sub-nav; operators can make them", async () => {
    await open("/sales/challans", {}, "operator");
    await screen.findByText("DC/26-27/0002");
    expect(rowWith("DC/26-27/0002")).toHaveTextContent(/Job work.*HR 51 AB 1234.*Issued/);
    expect(rowWith("DC/26-27/0001")).toHaveTextContent(/Sale/);
    expect(screen.getByRole("link", { name: "Challans" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "New challan" })).toHaveAttribute("href", "/sales/challans/new");
  });

  test("a confirmed order offers Create challan; the challan comes prefilled and saves ship-to and transport", async () => {
    await open("/sales/orders/9");
    expect(screen.getByRole("link", { name: "Create challan" })).toHaveAttribute("href", "/sales/challans/new?from=9");
    cleanup();
    const { user, sent } = await open("/sales/challans/new?from=9", {}, "operator");
    expect(screen.getByText(/^Made from 1 pending line/)).toBeInTheDocument();
    expect(picker("Challan type")).toHaveTextContent("Sale");
    expect(document.querySelector("[name=due_date]")).toBeNull(); // challans have no due date
    await user.click(await waitFor(() => picker("Ship to")));
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Same as billing address", "Plant 2, Plot 88, IMT, Faridabad"]);
    await user.click(screen.getByRole("option", { name: /Plant 2/ }));
    await user.type(box("Vehicle no."), "HR 51 AB 1234");
    await user.type(box("Transporter"), "Faridabad Roadways");
    await user.type(box("E-way bill no."), "3310 0012 3456");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      method: "POST", path: "/api/challans",
      body: {
        party_id: 3, challan_type: "sale", vehicle_no: "HR 51 AB 1234", transporter: "Faridabad Roadways", eway_bill_no: "3310 0012 3456",
        shipping_address: { label: "Plant 2", address: "Plot 88, IMT", city: "Faridabad", pincode: "121003", state_code: "06" },
        lines: [{ item_id: 1, qty: 400, from_line_id: 77 }],
      },
    });
  });

  test("a fresh challan needs its type before it saves", async () => {
    const { user, sent } = await open("/sales/challans/new", { "GET /parties": { total: 1, page: 1, page_size: 20, parties: [{ ...ACME_PARTY, city: "Faridabad" }] }, "GET /items": { total: 0, page: 1, page_size: 20, items: [] } });
    await user.type(screen.getByRole("combobox", { name: /Customer/ }), "acme");
    await user.click(await screen.findByRole("option", { name: /Acme Castings/ }, { timeout: 2000 }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await new Promise((r) => setTimeout(r, 300));
    expect(sent).toEqual([]);
    expect(picker("Challan type")).toHaveFocus(); // the browser shows its "select an item" message there
  });

  test("an operator edits and issues a draft; then it's read-only with Cancel challan and Print", async () => {
    const { user, sent } = await open("/sales/challans/9", {}, "operator");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Challan DC/26-27/0009");
    expect(picker("Challan type")).toHaveTextContent("Returnable");
    expect(box("Vehicle no.")).toHaveValue("HR 51 AB 1234");
    await waitFor(() => expect(picker("Ship to")).toHaveTextContent("Old godown, Plot 3, Ballabgarh (as on this document)")); // since removed from the party
    await user.click(screen.getByRole("button", { name: "Issue challan" }));
    expect(await screen.findByText("This challan is issued, so it can't be edited.")).toBeInTheDocument();
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual(["PUT /api/challans/9", "POST /api/challans/9/status"]);
    expect((sent[0]!.body as Record<string, unknown>).challan_type).toBe("returnable");
    expect(screen.getByRole("button", { name: "Cancel challan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Print" })).toHaveAttribute("href", "/print/challans/9");
  });

  test("a draft order can't be delivered yet", async () => {
    await open("/sales/orders/9", { "GET /sales-orders/9": doc("sales_order", "draft") });
    expect(screen.getByRole("button", { name: "Confirm order" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create challan" })).not.toBeInTheDocument();
  });

  test("changing the customer resets Ship to: the last customer's address isn't theirs", async () => {
    const delta = { ...ACME_PARTY, id: 4, name: "Delta Auto Components", gstin: null, addresses: [] };
    const { user, sent } = await open("/sales/challans/new", {
      "GET /parties": (req: Request) => ({ total: 1, page: 1, page_size: 20, parties: [new URL(req.url).searchParams.get("q") === "delta" ? { ...delta, city: "Delhi" } : { ...ACME_PARTY, city: "Faridabad" }] }),
      "GET /parties/4": delta,
    });
    const customer = screen.getByRole("combobox", { name: /Customer/ });
    await user.type(customer, "acme");
    await user.click(await screen.findByRole("option", { name: /Acme Castings/ }, { timeout: 2000 }));
    await user.click(await waitFor(() => picker("Ship to")));
    await user.click(await screen.findByRole("option", { name: /Plant 2/ }));
    expect(picker("Ship to")).toHaveTextContent("Plant 2");
    await user.clear(customer);
    await user.type(customer, "delta");
    await user.click(await screen.findByRole("option", { name: /Delta Auto/ }, { timeout: 2000 }));
    await waitFor(() => expect(picker("Ship to")).toHaveTextContent("Same as billing address"));
    expect(sent).toEqual([]);
  });

  test("viewers can't make challans or create them from orders", async () => {
    await open("/sales/orders/9", {}, "viewer");
    expect(screen.queryByRole("link", { name: "Create challan" })).not.toBeInTheDocument();
    cleanup();
    await open("/sales/challans", {}, "viewer");
    expect(screen.queryByRole("link", { name: "New challan" })).not.toBeInTheDocument();
  });
});
