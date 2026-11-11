import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { Shell } from "../../App.tsx";
import { PAGE_SIZE } from "../../components/ListUrl.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";

const STEEL = { id: 3, name: "Haryana Steel Traders", kind: "supplier", registration_type: "regular", gstin: "06AABCH1234A1Z5", state_code: "06", phone: null, city: "Faridabad", active: true };
const line = (extra = {}) => ({
  id: 21, position: 1, item_id: 1, item_code: "RM-12", item_name: "MS Bright Rod 12mm", description: "", hsn: "72155090", unit: "KGS", unit_decimals: 3,
  qty: 950_000, rejected_qty: 50_000, rate: 72_50, discount_bp: 0, gst_rate: 18, taxable: 68_875_00, cgst: 6_198_75, sgst: 6_198_75, igst: 0, from_line_id: 11, pending: 950_000, ...extra,
});
const grn = (status: string, extra = {}) => ({
  id: 7, type: "grn", fy: 2026, number: "GRN/26-27/0007", date: "2026-11-20", status, party_id: 3, party_name: STEEL.name, party_gstin: STEEL.gstin, party_state_code: "06",
  billing_address: { label: null, address: "Plot 77, Sector 25", city: "Faridabad", pincode: "121004", state_code: "06" }, shipping_address: null, place_of_supply: "06", reverse_charge: false,
  party_ref: "HST/DC/2231", party_ref_date: "2026-11-20", due_date: null, challan_type: null, note_reason: null, vehicle_no: "HR 51 AB 1234", transporter: null, eway_bill_no: null, cancel_reason: null, cancelled_at: null,
  taxable_total: 68_875_00, cgst_total: 6_198_75, sgst_total: 6_198_75, igst_total: 0, round_off: 0, grand_total: 81_272_00,
  notes: "", terms: "", created_by: 1, created_at: "", updated_at: `u-${status}`, lines: [line()], ...extra,
});
// What GET /grns/new?from=4 gives: PO 4's pending line, 1000 kg of rod.
const DRAFT = {
  type: "grn", date: "2026-11-20", party_id: 3, party: { id: 3, name: STEEL.name, gstin: STEEL.gstin, city: "Faridabad", state_code: "06" },
  shipping_address: null, place_of_supply: null, reverse_charge: false, party_ref: null, party_ref_date: null, due_date: null, challan_type: null, note_reason: null, vehicle_no: null, transporter: null, eway_bill_no: null,
  notes: "", terms: "", lines: [{ item_id: 1, description: "", qty: 1_000_000, rate: 72_50, discount_bp: 0, gst_rate: 18, from_line_id: 11, item_code: "RM-12", item_name: "MS Bright Rod 12mm", hsn: "72155090", unit: "KGS", unit_decimals: 3 }],
};
const poRow = (id: number, status: string, pending: number) =>
  ({ id, number: `PO/26-27/000${id}`, date: "2026-11-11", status, party_id: 3, party_name: STEEL.name, due_date: "2026-11-25", party_ref: null, challan_type: null, note_reason: null, vehicle_no: null, grand_total: 1_71_100_00, ordered_qty: 1_000_000, pending_qty: pending });
const po = { ...grn("finalized"), id: 4, type: "purchase_order", number: "PO/26-27/0004", party_ref: null, lines: [line({ id: 11, qty: 1_000_000, rejected_qty: 0, from_line_id: null, pending: 1_000_000 })] };

type Sent = { method: string; path: string; body: unknown };
async function open(url: string, routes: Record<string, unknown> = {}, role = "operator") {
  const sent: Sent[] = [];
  const asked: string[] = [];
  const record = (result: unknown) => async (req: Request) => {
    sent.push({ method: req.method, path: new URL(req.url).pathname, body: await req.json() });
    return result;
  };
  fakeApi({
    "GET /auth/me": { ...ME, role },
    "GET /company": COMPANY,
    "GET /grns": { total: 1, page: 1, page_size: PAGE_SIZE, grns: [{ ...poRow(7, "finalized", 0), number: "GRN/26-27/0007", party_ref: "HST/DC/2231" }] },
    "GET /grns/new": (req: Request) => {
      asked.push(new URL(req.url).search);
      return DRAFT;
    },
    "GET /grns/7": grn("draft"),
    "GET /purchase-orders/4": po,
    "GET /parties": { total: 1, page: 1, page_size: 20, parties: [STEEL] },
    "GET /purchase-orders": (req: Request) => {
      asked.push(new URL(req.url).search);
      return { total: 3, page: 1, page_size: 200, purchase_orders: [poRow(4, "finalized", 1_000_000), poRow(5, "finalized", 0), poRow(6, "draft", 1_000_000)] };
    },
    "POST /grns": record(grn("draft")),
    "PUT /grns/7": record(grn("draft")),
    "POST /grns/7/status": record(grn("finalized")),
    ...Object.fromEntries(Object.entries(routes).map(([k, v]) => [k, k.startsWith("GET") ? v : record(v)])),
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <Shell />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1 });
  return { user: userEvent.setup(), sent, asked };
}
const box = (name: string | RegExp) => screen.getByRole("textbox", { name });

describe("Purchase → GRNs", () => {
  test("stores records a receipt against a PO: pick the supplier and PO, accepted and rejected qty, the supplier's challan", async () => {
    const { user, sent, asked } = await open("/purchase/grns");
    expect(screen.getByRole("link", { name: "GRNs" })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText("HST/DC/2231")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Receive against PO" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByRole("combobox", { name: /Supplier/ }), "haryana");
    await user.click(await screen.findByRole("option", { name: /Haryana Steel/ }, { timeout: 2000 }));
    await dialog.findByRole("checkbox", { name: /PO\/26-27\/0004/ });
    expect(dialog.getAllByRole("checkbox")).toHaveLength(1); // not the fully received 5 or the draft 6
    await user.click(dialog.getByRole("checkbox", { name: /0004/ }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "Receive goods" })).toBeEnabled());
    await user.click(dialog.getByRole("button", { name: "Receive goods" }));

    expect(await screen.findByRole("heading", { level: 1, name: "New GRN" })).toBeInTheDocument();
    expect(asked.at(-1)).toBe("?from=4");
    expect(box("Accepted, line 1")).toHaveValue("1000.000");
    // 1000 kg came in; 50 kg failed inspection.
    await user.clear(box("Accepted, line 1"));
    await user.type(box("Accepted, line 1"), "950");
    await user.type(box("Rejected, line 1"), "50");
    await user.type(box("Supplier challan no."), "HST/DC/2231");
    await user.type(box("Vehicle no."), "HR 51 AB 1234");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      method: "POST", path: "/api/grns",
      body: { party_id: 3, party_ref: "HST/DC/2231", vehicle_no: "HR 51 AB 1234", lines: [{ item_id: 1, qty: 950_000, rejected_qty: 50_000, from_line_id: 11 }] },
    });
  });

  test("a bad rejected qty is shown on its field; none sends no rejected_qty", async () => {
    const { user, sent } = await open("/purchase/grns/new?from=4");
    await user.type(box("Rejected, line 1"), "abc");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a quantity with at most 3 decimals.")).toBeInTheDocument();
    expect(sent).toEqual([]);
    await user.clear(box("Rejected, line 1"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect((sent[0]!.body as { lines: Record<string, unknown>[] }).lines[0]).not.toHaveProperty("rejected_qty");
  });

  test("an opened GRN shows its accepted and rejected qty; Mark received locks it", async () => {
    const { user } = await open("/purchase/grns/7");
    expect(box("Accepted, line 1")).toHaveValue("950.000");
    expect(box("Rejected, line 1")).toHaveValue("50.000");
    await user.click(screen.getByRole("button", { name: "Mark received" }));
    expect(await screen.findByText("This GRN is received, so it can't be edited.")).toBeInTheDocument();
  });

  test("a sent PO offers Receive goods; other documents have no Rejected column", async () => {
    await open("/purchase/orders/4", {}, "accountant");
    expect(screen.getByRole("link", { name: "Receive goods" })).toHaveAttribute("href", "/purchase/grns/new?from=4");
    expect(screen.queryByRole("textbox", { name: "Rejected, line 1" })).not.toBeInTheDocument();
    expect(box("Qty, line 1")).toBeInTheDocument();
    cleanup();
    await open("/purchase/orders/4", { "GET /purchase-orders/4": { ...po, status: "draft" } }, "accountant");
    expect(screen.getByRole("button", { name: "Mark as sent" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Receive goods" })).not.toBeInTheDocument(); // not before it's sent
  });

  test("viewers only look", async () => {
    await open("/purchase/grns", {}, "viewer");
    await screen.findByText("HST/DC/2231");
    expect(screen.queryByRole("link", { name: "New GRN" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Receive against PO" })).not.toBeInTheDocument();
  });
});
