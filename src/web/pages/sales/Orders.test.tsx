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
    "GET /sales-orders": { total: 3, page: 1, page_size: PAGE_SIZE, sales_orders: [listRow(3, "SO/26-27/0003", "finalized", 1500, 0, "ACME/PO/4471"), listRow(2, "SO/26-27/0002", "finalized", 1500, 500), listRow(1, "SO/26-27/0001", "draft", 1000, 1000)] },
    "GET /sales-orders/new": DRAFT_FROM,
    "GET /sales-orders/9": doc("sales_order", "draft"),
    "GET /quotations/9": doc("quotation", "sent"),
    "POST /sales-orders": record(doc("sales_order", "draft")),
    "POST /sales-orders/9/status": record(doc("sales_order", "finalized", { lines: [line(1, { pending: 250 })] })),
    "PUT /sales-orders/9": record(doc("sales_order", "draft")),
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

describe("Sales → Orders", () => {
  test("list: customer PO and delivery progress; Orders in the Sales sub-nav", async () => {
    await open("/sales/orders");
    await screen.findByText("SO/26-27/0003");
    expect(rowWith("SO/26-27/0003")).toHaveTextContent(/ACME\/PO\/4471.*Delivered.*Confirmed/);
    expect(rowWith("SO/26-27/0002")).toHaveTextContent("Partly delivered");
    expect(rowWith("SO/26-27/0001")).not.toHaveTextContent(/deliver/i); // drafts don't deliver
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute("aria-current", "page");
  });

  test("a sent quotation offers Create sales order, which opens the order prefilled from it", async () => {
    await open("/sales/quotations/9");
    expect(screen.getByRole("link", { name: "Create sales order" })).toHaveAttribute("href", "/sales/orders/new?from=9");
    cleanup();
    const { user, sent } = await open("/sales/orders/new?from=9");
    expect(screen.getByText("Made from 1 pending line. Change quantities to take less, or remove lines you don't need now.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Customer/ })).toHaveValue("Acme Castings Pvt Ltd");
    expect(screen.getByRole("combobox", { name: /Customer/ })).toHaveAttribute("readonly"); // the quotations' customer
    expect(screen.getByRole("combobox", { name: "Item, line 1" })).toHaveValue("FG-101 – Hex Bolt M10 x 50");
    expect(box("Qty, line 1")).toHaveValue("400");
    await user.clear(box("Qty, line 1"));
    await user.type(box("Qty, line 1"), "300");
    await user.type(box(/Customer PO no/), "ACME/PO/4471");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ method: "POST", path: "/api/sales-orders", body: { party_id: 3, party_ref: "ACME/PO/4471", lines: [{ item_id: 1, qty: 300, rate: 12_50, from_line_id: 77 }] } });
  });

  test("a draft order: Deliver by, Customer PO, Confirm; once confirmed, ordered / delivered / pending per line", async () => {
    const { user, sent } = await open("/sales/orders/9");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sales order SO/26-27/0004");
    expect(screen.queryByLabelText("Progress")).not.toBeInTheDocument(); // nothing delivers from a draft
    expect(screen.getByText("Deliver by")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm order" }));
    expect(await screen.findByText("This sales order is confirmed, so it can't be edited.")).toBeInTheDocument();
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual(["PUT /api/sales-orders/9", "POST /api/sales-orders/9/status"]);
    const progress = within(screen.getByLabelText("Progress"));
    expect(progress.getAllByRole("row")[1]).toHaveTextContent("Hex Bolt M10 x 501000 NOS750 NOS250 NOS");
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeInTheDocument();
  });

  test("picking another item on a converted line unlinks it from the quotation", async () => {
    const { user, sent } = await open("/sales/orders/new?from=9", { "GET /items": { total: 1, page: 1, page_size: 20, items: [{ id: 2, code: "FG-220", name: "Flange Plate", type: "finished", hsn: "73079990", unit: "NOS", unit_decimals: 0, gst_rate: 18, sale_price: 845_00, purchase_price: 0, active: true }] } });
    const picker = screen.getByRole("combobox", { name: "Item, line 1" });
    await user.clear(picker);
    await user.type(picker, "flange");
    await user.click(await screen.findByRole("option", { name: /Flange/ }, { timeout: 2000 }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect((sent[0]!.body as { lines: Record<string, unknown>[] }).lines[0]).toEqual({ item_id: 2, description: "", qty: 400, rate: 845_00, discount_bp: 0, gst_rate: 18 });
  });

  test("final moves ask first: Keep it sends nothing; confirming cancels", async () => {
    const { user, sent } = await open("/sales/orders/9", {
      "GET /sales-orders/9": doc("sales_order", "finalized"),
      "POST /sales-orders/9/status": doc("sales_order", "cancelled"),
    });
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    const dialog = await screen.findByRole("alertdialog", { name: /^Mark sales order/ });
    expect(dialog).toHaveTextContent("Mark sales order SO/26-27/0004 as cancelled?This can't be undone.");
    await user.click(within(dialog).getByRole("button", { name: "Keep it" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", { name: /^Mark/ })).not.toBeInTheDocument());
    expect(sent).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    await user.click(within(await screen.findByRole("alertdialog", { name: /^Mark/ })).getByRole("button", { name: "Cancel order" }));
    expect(await screen.findByText("This sales order is cancelled, so it can't be edited.")).toBeInTheDocument();
    expect(sent).toEqual([{ method: "POST", path: "/api/sales-orders/9/status", body: { status: "cancelled" } }]);
  });

  test("a quotation's Rejected asks too (Mark as sent goes straight through: QuotationForm tests)", async () => {
    const { user, sent } = await open("/sales/quotations/9");
    await user.click(screen.getByRole("button", { name: "Rejected" }));
    expect(await screen.findByRole("alertdialog", { name: "Mark quotation QTN/26-27/0009 as rejected?" })).toHaveTextContent("This can't be undone.");
    expect(sent).toEqual([]);
  });

  test("From quotations: pick the customer, tick their open quotations, open one order from them all", async () => {
    const asked: string[] = [];
    const q = (id: number, status: string, pending: number) => ({ ...listRow(id, `QTN/26-27/000${id}`, status, 1000, pending), due_date: null });
    const { user } = await open("/sales/orders", {
      "GET /parties": { total: 1, page: 1, page_size: 20, parties: [{ id: 3, name: "Acme Castings Pvt Ltd", gstin: "06AAACA1234B1ZM", city: "Faridabad", state_code: "06", kind: "customer", phone: null, active: true }] },
      "GET /sales-orders/new": (req: Request) => {
        asked.push(new URL(req.url).search);
        return DRAFT_FROM;
      },
      "GET /quotations": (req: Request) => {
        asked.push(new URL(req.url).search);
        return { total: 5, page: 1, page_size: 200, quotations: [q(1, "sent", 1000), q(2, "accepted", 400), q(3, "accepted", 0), q(4, "draft", 1000), q(5, "rejected", 1000)] };
      },
    });
    await user.click(screen.getByRole("button", { name: "From quotations" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("button", { name: "Create order" })).toBeDisabled();
    await user.type(dialog.getByRole("combobox", { name: /Customer/ }), "acme");
    await user.click(await screen.findByRole("option", { name: /Acme Castings/ }, { timeout: 2000 }));
    await dialog.findByRole("checkbox", { name: /QTN\/26-27\/0001/ });
    expect(asked[0]).toContain("party_id=3");
    // Only sent / accepted with something left: not the fully ordered 3, the draft 4 or the rejected 5.
    expect(dialog.getAllByRole("checkbox").map((c) => c.closest("label")?.textContent)).toEqual([
      "QTN/26-27/0001 · 11 Nov 2026 · ₹14,750.00",
      "QTN/26-27/0002 · 11 Nov 2026 · ₹14,750.00",
    ]);
    await user.click(dialog.getByRole("checkbox", { name: /0001/ }));
    await user.click(dialog.getByRole("checkbox", { name: /0002/ }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "Create order" })).toBeEnabled());
    await user.click(dialog.getByRole("button", { name: "Create order" }));
    expect(await screen.findByRole("heading", { level: 1, name: "New sales order" })).toBeInTheDocument();
    expect(screen.getByText(/^Made from 1 pending line/)).toBeInTheDocument();
    expect(asked.at(-1)).toBe("?from=1%2C2");
  });

  test("a draft quotation can't be ordered yet", async () => {
    await open("/sales/quotations/9", { "GET /quotations/9": doc("quotation", "draft") });
    expect(screen.getByRole("button", { name: "Mark as sent" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create sales order" })).not.toBeInTheDocument();
  });

  test("viewers can't create orders or convert quotations", async () => {
    await open("/sales/quotations/9", {}, "viewer");
    expect(screen.queryByRole("link", { name: "Create sales order" })).not.toBeInTheDocument();
    cleanup();
    await open("/sales/orders", {}, "viewer");
    expect(screen.queryByRole("link", { name: "New sales order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "From quotations" })).not.toBeInTheDocument();
  });
});
