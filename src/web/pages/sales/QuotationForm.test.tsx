import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { todayInIndia } from "../../../shared/fy.ts";
import { Shell } from "../../Shell.tsx";
import { SEARCH_DELAY_MS } from "../../components/ListUrl.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";

const SHARMA = { id: 3, name: "Sharma Traders", kind: "customer", registration_type: "regular", gstin: "06AABCS1234A1Z5", state_code: "06", phone: null, city: "Faridabad", active: true, opening_balance: 0 };
const DELHI = { ...SHARMA, id: 4, name: "Sharma Steel Delhi", gstin: "07AABCS9999A1Z2", state_code: "07", city: "New Delhi" };
const BOLT = { id: 1, code: "FG-101", name: "Hex Bolt M10 x 50", type: "finished", hsn: "73181500", unit: "NOS", unit_decimals: 0, gst_rate: 18, sale_price: 12_50, purchase_price: 9_00, active: true };
const line = { id: 11, position: 1, item_id: 1, item_code: "FG-101", item_name: "Hex Bolt M10 x 50", description: "", hsn: "73181500", unit: "NOS", unit_decimals: 0, qty: 1000, rate: 12_50, discount_bp: 0, gst_rate: 18, taxable: 12_500_00, cgst: 1_125_00, sgst: 1_125_00, igst: 0 };
const quotation = (status: string, extra = {}) => ({
  id: 9, type: "quotation", fy: 2026, number: "QTN/26-27/0009", date: "2026-11-11", status, party_id: 3, party_name: "Sharma Traders", party_gstin: SHARMA.gstin, party_state_code: "06",
  billing_address: { label: null, address: "Plot 4", city: "Faridabad", pincode: "121001", state_code: "06" }, shipping_address: null, place_of_supply: "06", reverse_charge: false,
  party_ref: null, party_ref_date: null, due_date: "2026-11-25", challan_type: null, vehicle_no: null, transporter: null, eway_bill_no: null,
  taxable_total: 12_500_00, cgst_total: 1_125_00, sgst_total: 1_125_00, igst_total: 0, round_off: 0, grand_total: 14_750_00,
  notes: "", terms: "Ex-works Faridabad.", created_by: 1, created_at: "", updated_at: `u-${status}`, lines: [line], ...extra,
});

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
    "GET /company": COMPANY,
    "GET /quotations": { total: 0, quotations: [], page: 1, page_size: 50 },
    "GET /quotations/9": quotation("draft"),
    "GET /parties": (req: Request) => {
      partyQueries.push(Object.fromEntries(new URL(req.url).searchParams));
      const q = (new URL(req.url).searchParams.get("q") ?? "").toLowerCase();
      const parties = [SHARMA, DELHI].filter((p) => p.name.toLowerCase().includes(q));
      return { total: parties.length, parties, page: 1, page_size: 20 };
    },
    "GET /items": { total: 1, items: [BOLT], page: 1, page_size: 20 },
    "POST /quotations": record(quotation("draft")),
    "PUT /quotations/9": record(quotation("draft", { notes: "saved" })),
    "POST /quotations/9/status": record(quotation("sent")),
    ...Object.fromEntries(Object.entries(routes).map(([k, v]) => [k, k.startsWith("GET") ? v : record(v)])),
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <Shell />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: /quotation/i });
  return { user: userEvent.setup(), sent, partyQueries };
}
const wait = () => act(() => Bun.sleep(SEARCH_DELAY_MS + 50));
const box = (name: string | RegExp) => screen.getByRole("textbox", { name });

describe("Sales → Quotations → form", () => {
  test("create: the customer picker shows GSTIN and city; picking an item fills the line; Save posts it", async () => {
    const { user, sent, partyQueries } = await open("/sales/quotations/new");
    await user.type(screen.getByRole("combobox", { name: /Customer/ }), "sharma");
    await wait();
    expect(partyQueries.at(-1)).toEqual({ q: "sharma", kind: "customer", page_size: "20" }); // customers only
    const option = await screen.findByRole("option", { name: /Sharma Traders/ });
    expect(option).toHaveTextContent("06AABCS1234A1Z5 · Faridabad");
    expect(screen.getByRole("option", { name: /Sharma Steel Delhi/ })).toHaveTextContent("07AABCS9999A1Z2 · New Delhi");
    await user.click(option);
    expect(screen.getByText("06AABCS1234A1Z5 · Faridabad")).toBeInTheDocument(); // under the field

    await user.type(screen.getByRole("combobox", { name: "Item, line 1" }), "bolt");
    await wait();
    await user.click(await screen.findByRole("option", { name: /Hex Bolt/ }));
    await user.type(box("Qty, line 1"), "1000");
    await user.type(box(/Terms/), "Ex-works Faridabad.");
    expect(screen.getByLabelText("Totals")).toHaveTextContent("CGST1,125.00SGST1,125.00");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Quotation QTN/26-27/0009" })).toBeInTheDocument(); // opened after saving
    expect(sent).toEqual([{ method: "POST", path: "/api/quotations", body: {
      party_id: 3, date: todayInIndia(), due_date: null, party_ref: null, party_ref_date: null, terms: "Ex-works Faridabad.", notes: "",
      lines: [{ item_id: 1, description: "", qty: 1000, rate: 12_50, discount_bp: 0, gst_rate: 18 }],
    } }]);
  });

  test("a Delhi customer: the live totals switch to IGST", async () => {
    const { user } = await open("/sales/quotations/new");
    await user.type(screen.getByRole("combobox", { name: /Customer/ }), "delhi");
    await wait();
    await user.click(await screen.findByRole("option", { name: /Sharma Steel Delhi/ }));
    await user.type(screen.getByRole("combobox", { name: "Item, line 1" }), "bolt");
    await wait();
    await user.click(await screen.findByRole("option", { name: /Hex Bolt/ }));
    await user.type(box("Qty, line 1"), "1000");
    expect(screen.getByLabelText("Totals")).toHaveTextContent("IGST2,250.00");
  });

  test("edit a draft: loads its party and lines; Save puts the changes", async () => {
    const { user, sent } = await open("/sales/quotations/9");
    expect(screen.getByRole("combobox", { name: /Customer/ })).toHaveValue("Sharma Traders");
    expect(screen.getByRole("combobox", { name: "Item, line 1" })).toHaveValue("FG-101 – Hex Bolt M10 x 50");
    expect(box("Qty, line 1")).toHaveValue("1000");
    await user.clear(box("Qty, line 1"));
    await user.type(box("Qty, line 1"), "2000");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent.length).toBe(1));
    expect(sent[0]).toMatchObject({ method: "PUT", path: "/api/quotations/9", body: { party_id: 3, date: "2026-11-11", due_date: "2026-11-25", terms: "Ex-works Faridabad.", lines: [{ item_id: 1, qty: 2000, rate: 12_50 }] } });
  });

  test("status: a draft can be marked sent; then it's read-only with Accepted / Rejected / Expired", async () => {
    const { user, sent } = await open("/sales/quotations/9");
    await user.click(screen.getByRole("button", { name: "Mark as sent" }));
    expect(await screen.findByText("This quotation is sent, so it can't be edited.")).toBeInTheDocument();
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual(["PUT /api/quotations/9", "POST /api/quotations/9/status"]); // saves first
    expect(sent[1]!.body).toEqual({ status: "sent" });
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Qty, line 1" })).toBeNull(); // read as a document now
    expect(screen.getByRole("cell", { name: "Qty, line 1" })).toBeInTheDocument();
    for (const name of ["Accepted", "Rejected", "Expired"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as sent" })).not.toBeInTheDocument();
  });

  test("errors: no customer is caught before sending; server field errors show on the cell", async () => {
    const bad = Response.json({ error: { code: "VALIDATION", message: "x", details: { fields: { "lines.0.qty": ["Quantity is too large."] } } } }, { status: 400 });
    const { user, sent } = await open("/sales/quotations/new", { "POST /quotations": bad });
    expect(screen.queryByRole("button", { name: "Mark as sent" })).not.toBeInTheDocument(); // not until it's saved
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: /Customer/ })).toHaveAttribute("aria-invalid", "true")); // the required field stops the save
    expect(sent).toEqual([]);
    await user.type(screen.getByRole("combobox", { name: /Customer/ }), "sharma");
    await wait();
    await user.click(await screen.findByRole("option", { name: /Sharma Traders/ }));
    await user.click(screen.getByRole("button", { name: "Save" })); // a customer but no lines
    expect(await screen.findByText("Add at least one line.")).toBeInTheDocument();
    expect(sent).toEqual([]);
    await user.type(screen.getByRole("combobox", { name: "Item, line 1" }), "bolt");
    await wait();
    await user.click(await screen.findByRole("option", { name: /Hex Bolt/ }));
    await user.click(screen.getByRole("button", { name: "Save" })); // an item but no qty
    expect(await screen.findByText("Enter a quantity.")).toBeInTheDocument();
    expect(sent).toEqual([]);
    await user.type(box("Qty, line 1"), "9");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Quantity is too large.")).toBeInTheDocument();
  });

  test("operators and viewers see a draft read-only, with no status buttons", async () => {
    for (const role of ["operator", "viewer"]) {
      cleanup();
      await open("/sales/quotations/9", {}, role);
      expect(screen.getByText("You can view quotations; ask an accountant or admin to change them.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Mark as sent" })).not.toBeInTheDocument();
    }
  });
});
