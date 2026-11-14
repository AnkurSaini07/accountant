import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { Shell } from "../../Shell.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";
import { pick, picker } from "../../test/select.ts";
import { rateChoices } from "./ItemEditor.tsx";

const UNITS = [
  { id: 1, code: "NOS", name: "Numbers", decimals: 0, active: true },
  { id: 3, code: "KGS", name: "Kilograms", decimals: 3, active: true },
  { id: 8, code: "OLD", name: "Retired unit", decimals: 0, active: false },
];
const RATES = [
  { id: 1, rate: 0, effective_from: "2017-07-01", active: true },
  { id: 4, rate: 5, effective_from: "2017-07-01", active: true },
  { id: 6, rate: 18, effective_from: "2017-07-01", active: true },
  { id: 9, rate: 18, effective_from: "2099-04-01", active: true }, // not yet in force
  { id: 7, rate: 28, effective_from: "2017-07-01", active: false },
];
const ROD = {
  id: 2, code: "RM-1", name: "MS Rod 12mm", description: "", type: "raw", hsn: "7214", unit_id: 3, unit: "KGS", unit_decimals: 3, gst_rate_id: 4, gst_rate: 5,
  sale_price: 72_50, purchase_price: 65_00, opening_qty: 1_250, opening_value: 81_250_00, reorder_level: 500, active: true, updated_at: "",
};
type Body = Record<string, unknown>;

async function open(url: string, { role = "admin", write }: { role?: string; write?: () => Response } = {}) {
  const writes: { path: string; body: Body }[] = [];
  const answer = (status: number, result: (b: Body) => unknown) => async (req: Request) => {
    const path = `${req.method} ${new URL(req.url).pathname}`;
    const body = (path.endsWith("activate") ? {} : await req.json()) as Body;
    writes.push({ path, body });
    return write?.() ?? Response.json(result(body), { status });
  };
  fakeApi({
    "GET /auth/me": { ...ME, role },
    "GET /company": COMPANY,
    "GET /units": UNITS,
    "GET /gst-rates": RATES,
    "GET /items": { total: 0, items: [], page: 1, page_size: 50 },
    "GET /items/2": ROD,
    "POST /items": answer(201, (b) => ({ ...ROD, ...b, id: 5 })),
    "PUT /items/2": answer(200, (b) => ({ ...ROD, ...b })),
    "POST /items/2/deactivate": answer(200, () => ({ ...ROD, active: false })),
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <Shell />
    </MemoryRouter>,
  );
  return { user: userEvent.setup(), writes };
}
const field = (label: string | RegExp) => screen.getByRole("textbox", { name: label });
test("rateChoices: active rates in force today, newest per rate, plus the item's own", () => {
  const today = "2026-11-11";
  expect(rateChoices(RATES, null, today).map((r) => r.id)).toEqual([1, 4, 6]);
  expect(rateChoices(RATES, 7, today).map((r) => r.id)).toEqual([1, 4, 6, 7]); // the item's retired 28% stays visible
  expect(rateChoices(RATES, null, "2099-05-01").map((r) => r.id)).toEqual([1, 4, 9]); // the newer 18% takes over
});

describe("new item", () => {
  test("prices in rupees and quantities in the unit, sent as paise and smallest steps; back to the list", async () => {
    const { user, writes } = await open("/masters/items/new");
    await screen.findByRole("heading", { name: "New item" });
    expect(field("Code")).toHaveFocus();
    await user.keyboard("RM-2");
    await user.type(field("Name"), "MS Flat 40x6");
    await pick(user, "Type", "Raw material");
    await user.type(field("HSN"), "7211");
    expect(picker("Unit")).toHaveDisplayValue("NOS – Numbers"); // the default
    await pick(user, "Unit", "KGS – Kilograms");
    const rates = [...picker("GST rate").options].filter((o) => o.value).map((o) => o.textContent);
    expect(rates).toEqual(["0%", "5%", "18%"]); // no inactive 28%, no future 18%
    await pick(user, "GST rate", "18%");
    await user.type(field(/^Sale price/), "1,250.50");
    await user.type(field(/^Opening quantity \(KGS\)/), "1.25");
    await user.type(field("Opening value (₹)"), "1563.13");
    await user.type(field(/^Reorder level/), "0.5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Items" })).toBeInTheDocument();
    expect(writes).toEqual([{
      path: "POST /api/items",
      body: { code: "RM-2", name: "MS Flat 40x6", description: "", type: "raw", hsn: "7211", unit_id: 3, gst_rate_id: 6, sale_price: 1_250_50, purchase_price: 0, opening_qty: 1_250, opening_value: 1_563_13, reorder_level: 500 },
    }]);
  });

  test("a service has no stock fields and sends none; HSN is called SAC", async () => {
    const { user, writes } = await open("/masters/items/new");
    await user.type(await screen.findByRole("textbox", { name: "Code" }), "SVC-1");
    await user.type(field("Name"), "Machining charges");
    await pick(user, "Type", "Service");
    expect(screen.queryByRole("textbox", { name: /Opening quantity/ })).not.toBeInTheDocument();
    expect(field("SAC")).toBeInTheDocument();
    await pick(user, "GST rate", "18%");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]!.body).toMatchObject({ type: "service", opening_qty: 0, opening_value: 0, reorder_level: null });
  });

  test("too many decimals for the unit, or a bad amount, is caught before sending", async () => {
    const { user, writes } = await open("/masters/items/new");
    await user.type(await screen.findByRole("textbox", { name: "Code" }), "X");
    await user.type(field("Name"), "X");
    await pick(user, "GST rate", "5%");
    await user.type(field(/^Opening quantity \(NOS\)/), "1.5"); // NOS: whole numbers
    await user.type(field(/^Sale price/), "twelve");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a whole number.")).toBeInTheDocument();
    expect(screen.getByText("Enter an amount like 250 or 1,250.50.")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  test("server field errors show inline (duplicate code 409)", async () => {
    const dup = () => Response.json({ error: { code: "CONFLICT", message: "Item code RM-1 is already used.", details: { fields: { code: ["Item code RM-1 is already used."] } } } }, { status: 409 });
    const { user } = await open("/masters/items/new", { write: dup });
    await user.type(await screen.findByRole("textbox", { name: "Code" }), "RM-1");
    await user.type(field("Name"), "Dup");
    await pick(user, "GST rate", "5%");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Item code RM-1 is already used.")).toBeInTheDocument();
    expect(field("Code")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("existing item", () => {
  test("loads with quantities in its unit and prices in rupees; saves with PUT", async () => {
    const { user, writes } = await open("/masters/items/2");
    expect(await screen.findByRole("heading", { name: "Item MS Rod 12mm" })).toBeInTheDocument();
    expect(field(/^Opening quantity \(KGS\)/)).toHaveValue("1.250");
    expect(field(/^Reorder level \(KGS\)/)).toHaveValue("0.500");
    expect(field("Opening value (₹)")).toHaveValue("81250.00");
    expect(field("Sale price (₹) per KGS")).toHaveValue("72.50");
    expect(picker("GST rate")).toHaveDisplayValue("5%");
    await user.clear(field("Sale price (₹) per KGS"));
    await user.type(field("Sale price (₹) per KGS"), "75");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ path: "PUT /api/items/2", body: { sale_price: 75_00, opening_qty: 1_250, reorder_level: 500, unit_id: 3, gst_rate_id: 4 } });
  });

  test("deactivate shows the badge", async () => {
    const { user, writes } = await open("/masters/items/2");
    await user.click(await screen.findByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("Inactive")).toBeInTheDocument();
    expect(writes.map((w) => w.path)).toEqual(["POST /api/items/2/deactivate"]);
  });

  test("operators and viewers see it read-only", async () => {
    for (const role of ["operator", "viewer"]) {
      cleanup(); // one render per role
      await open("/masters/items/2", { role });
      await screen.findByRole("heading", { name: "Item MS Rod 12mm" });
      expect(field("Name")).toHaveAttribute("readonly");
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Back to items" })).toBeInTheDocument();
    }
  });
});
