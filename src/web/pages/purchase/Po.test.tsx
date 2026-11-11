import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { todayInIndia } from "../../../shared/fy.ts";
import { Shell } from "../../App.tsx";
import { PAGE_SIZE, SEARCH_DELAY_MS } from "../../components/ListUrl.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";

const STEEL = { id: 3, name: "Haryana Steel Traders", kind: "supplier", registration_type: "regular", gstin: "06AABCH1234A1Z5", state_code: "06", phone: null, city: "Faridabad", active: true, opening_balance: 0 };
const OKHLA = { ...STEEL, id: 4, name: "Okhla Wire Mills", gstin: "07AABCO9999A1Z2", state_code: "07", city: "New Delhi" };
const ROD = { id: 1, code: "RM-12", name: "MS Bright Rod 12mm", type: "raw", hsn: "72155090", unit: "KGS", unit_decimals: 3, gst_rate: 18, sale_price: 0, purchase_price: 74_20, active: true };
const line = { id: 11, position: 1, item_id: 1, item_code: "RM-12", item_name: "MS Bright Rod 12mm", description: "", hsn: "72155090", unit: "KGS", unit_decimals: 3, qty: 1_000_000, rate: 74_20, discount_bp: 0, gst_rate: 18, taxable: 74_200_00, cgst: 6_678_00, sgst: 6_678_00, igst: 0, from_line_id: null, pending: 400_000 };
const po = (status: string, extra = {}) => ({
  id: 9, type: "purchase_order", fy: 2026, number: "PO/26-27/0009", date: "2026-11-11", status, party_id: 3, party_name: STEEL.name, party_gstin: STEEL.gstin, party_state_code: "06",
  billing_address: { label: null, address: "Plot 77, Sector 25", city: "Faridabad", pincode: "121004", state_code: "06" }, shipping_address: null, place_of_supply: "06", reverse_charge: false,
  party_ref: "HST/Q/118", party_ref_date: "2026-11-05", due_date: "2026-11-25", challan_type: null, note_reason: null, vehicle_no: null, transporter: null, eway_bill_no: null, cancel_reason: null, cancelled_at: null,
  taxable_total: 74_200_00, cgst_total: 6_678_00, sgst_total: 6_678_00, igst_total: 0, round_off: 0, grand_total: 87_556_00,
  notes: "", terms: "Delivery at our works. Payment 30 days.", created_by: 1, created_at: "", updated_at: `u-${status}`, lines: [line], ...extra,
});
const row = (id: number, number: string, status: string, ordered: number, pending: number) =>
  ({ id, number, date: "2026-11-11", status, party_id: 3, party_name: STEEL.name, due_date: "2026-11-25", party_ref: null, challan_type: null, note_reason: null, vehicle_no: null, grand_total: 87_556_00, ordered_qty: ordered, pending_qty: pending });

type Sent = { method: string; path: string; body: unknown };
async function open(url: string, routes: Record<string, unknown> = {}, role = ME.role as string) {
  const sent: Sent[] = [];
  const partyQueries: Record<string, string>[] = [];
  const record = (result: unknown) => async (req: Request) => {
    sent.push({ method: req.method, path: new URL(req.url).pathname, body: await req.json() });
    return result;
  };
  fakeApi({
    "GET /auth/me": { ...ME, role },
    "GET /company": { ...COMPANY, gstin: "06AAACS1111A1Z1" },
    "GET /purchase-orders": { total: 3, page: 1, page_size: PAGE_SIZE, purchase_orders: [row(3, "PO/26-27/0003", "finalized", 1000, 0), row(2, "PO/26-27/0002", "finalized", 1000, 400), row(1, "PO/26-27/0001", "draft", 1000, 1000)] },
    "GET /purchase-orders/9": po("draft"),
    "GET /parties": (req: Request) => {
      partyQueries.push(Object.fromEntries(new URL(req.url).searchParams));
      const q = (new URL(req.url).searchParams.get("q") ?? "").toLowerCase();
      const parties = [STEEL, OKHLA].filter((p) => p.name.toLowerCase().includes(q));
      return { total: parties.length, parties, page: 1, page_size: 20 };
    },
    "GET /items": { total: 1, items: [ROD], page: 1, page_size: 20 },
    "POST /purchase-orders": record(po("draft")),
    "PUT /purchase-orders/9": record(po("draft")),
    "POST /purchase-orders/9/status": record(po("finalized")),
    ...Object.fromEntries(Object.entries(routes).map(([k, v]) => [k, k.startsWith("GET") ? v : record(v)])),
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <Shell />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1 });
  return { user: userEvent.setup(), sent, partyQueries };
}
const wait = () => act(() => Bun.sleep(SEARCH_DELAY_MS + 50));
const box = (name: string | RegExp) => screen.getByRole("textbox", { name });
const rowWith = (text: string) => screen.getAllByRole("row").find((r) => r.textContent?.includes(text))!;
const pickSupplier = async (user: ReturnType<typeof userEvent.setup>, q: string, name: RegExp) => {
  await user.type(screen.getByRole("combobox", { name: /Supplier/ }), q);
  await wait();
  await user.click(await screen.findByRole("option", { name }));
};

describe("Purchase → Orders", () => {
  test("Purchase opens its orders: delivery date and how much has been received", async () => {
    await open("/purchase");
    expect(await screen.findByRole("heading", { level: 1, name: "Purchase orders" })).toBeInTheDocument();
    await screen.findByText("PO/26-27/0003");
    expect(rowWith("PO/26-27/0003")).toHaveTextContent(/25 Nov 2026.*Received.*Sent/);
    expect(rowWith("PO/26-27/0002")).toHaveTextContent("Partly received");
    expect(rowWith("PO/26-27/0001")).not.toHaveTextContent(/received/i); // a draft hasn't been sent
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "New purchase order" })).toHaveAttribute("href", "/purchase/orders/new");
  });

  test("new: suppliers only; the purchase price fills the rate; delivery date and the supplier's quotation; Save posts it", async () => {
    const { user, sent, partyQueries } = await open("/purchase/orders/new");
    await pickSupplier(user, "haryana", /Haryana Steel/);
    expect(partyQueries.at(-1)).toMatchObject({ kind: "supplier" });
    await user.type(screen.getByRole("combobox", { name: "Item, line 1" }), "rod");
    await wait();
    await user.click(await screen.findByRole("option", { name: /MS Bright Rod/ }));
    expect(box("Rate, line 1")).toHaveValue("74.20"); // the purchase price, not the sale price
    await user.type(box("Qty, line 1"), "1000");
    await user.type(box("Supplier's quotation no."), "HST/Q/118");
    expect(screen.getByLabelText("Totals")).toHaveTextContent("CGST6,678.00SGST6,678.00");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("heading", { name: "Purchase order PO/26-27/0009" })).toBeInTheDocument();
    expect(sent).toEqual([{ method: "POST", path: "/api/purchase-orders", body: {
      party_id: 3, date: todayInIndia(), due_date: null, party_ref: "HST/Q/118", party_ref_date: null, terms: "", notes: "",
      lines: [{ item_id: 1, description: "", qty: 1_000_000, rate: 74_20, discount_bp: 0, gst_rate: 18 }],
    } }]);
  });

  test("a Delhi supplier: the goods come to Haryana, so the live totals show IGST", async () => {
    const { user } = await open("/purchase/orders/new");
    await pickSupplier(user, "okhla", /Okhla Wire/);
    await user.type(screen.getByRole("combobox", { name: "Item, line 1" }), "rod");
    await wait();
    await user.click(await screen.findByRole("option", { name: /MS Bright Rod/ }));
    await user.type(box("Qty, line 1"), "1000");
    expect(screen.getByLabelText("Totals")).toHaveTextContent("IGST13,356.00");
  });

  test("Mark as sent locks it; received so far per line; printable", async () => {
    const { user, sent } = await open("/purchase/orders/9");
    await user.click(screen.getByRole("button", { name: "Mark as sent" }));
    expect(await screen.findByText("This purchase order is sent, so it can't be edited.")).toBeInTheDocument();
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual(["PUT /api/purchase-orders/9", "POST /api/purchase-orders/9/status"]);
    expect(screen.getByRole("heading", { name: "Received so far" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Print/ })).toHaveAttribute("href", "/print/purchase-orders/9");
  });

  test("viewers can't make purchase orders", async () => {
    await open("/purchase/orders", {}, "viewer");
    expect(screen.queryByRole("link", { name: "New purchase order" })).not.toBeInTheDocument();
  });
});

describe("Purchase → Orders → print", () => {
  test("ready for the supplier: Purchase Order, supplier, deliver to our works, delivery date, their quotation, no bank details", async () => {
    const bank = { bank_name: "Punjab National Bank", account_name: null, account_number: "0123456789", ifsc: "PUNB0012300", branch: "NIT Faridabad", is_default: true };
    fakeApi({ "GET /auth/me": ME, "GET /company": { ...COMPANY, gstin: "06AAACS1111A1Z1", bank_accounts: [bank] }, "GET /purchase-orders/9": po("finalized") });
    render(
      <MemoryRouter initialEntries={["/print/purchase-orders/9"]}>
        <Shell />
      </MemoryRouter>,
    );
    const sheet = await screen.findByRole("article", { name: "Purchase Order PO/26-27/0009" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Purchase Order");
    expect(screen.getByLabelText("Supplier")).toHaveTextContent("Haryana Steel TradersPlot 77, Sector 25Faridabad – 121004Haryana (06)GSTIN 06AABCH1234A1Z5");
    expect(screen.getByLabelText("Deliver to")).toHaveTextContent(new RegExp(`${COMPANY.legal_name}.*Haryana \\(06\\)GSTIN 06AAACS1111A1Z1`));
    expect(screen.queryByLabelText("Ship to")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Details")).toHaveTextContent("Delivery by25 Nov 2026Your quotationHST/Q/118Quotation date05 Nov 2026");
    expect(within(screen.getByRole("table", { name: "Lines" })).getAllByRole("row")[1]).toHaveTextContent(/MS Bright Rod 12mm72155090\s*1000\.000KGS74\.20/);
    expect(screen.queryByLabelText("Bank details")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Terms")).toHaveTextContent("Delivery at our works. Payment 30 days.");
    expect(sheet).toHaveTextContent("Authorised Signatory");
    await waitFor(() => expect(document.title).toBe("Purchase order PO/26-27/0009 – Haryana Steel Traders"));
  });
});
