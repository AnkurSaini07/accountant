import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { gstinCheckChar } from "../../../shared/gstin.ts";
import { Shell } from "../../App.tsx";
import { COMPANY, fakeApi, ME } from "../../test/fake-api.ts";

const DL = "07AABCS1234A1Z" + gstinCheckChar("07AABCS1234A1Z");
const SAVED = {
  id: 7, name: "Sharma Steels Pvt Ltd", kind: "customer", registration_type: "regular", gstin: DL, pan: "AABCS1234A", state_code: "07",
  contact_person: "R. Sharma", phone: "9811000001", email: null, credit_days: 30, credit_limit: 5_00_000_00, opening_balance: -1_23_456_78,
  active: true, updated_at: "2026-11-11T00:00:00Z",
  addresses: [
    { id: 1, kind: "billing", label: null, address: "12 Okhla Phase II", city: "New Delhi", pincode: "110020", state_code: "07" },
    { id: 2, kind: "shipping", label: "Plant 2", address: "", city: "Faridabad", pincode: null, state_code: "06" },
  ],
};
type Body = Record<string, unknown> & { addresses: Record<string, unknown>[] };

/** Renders the app at `url`; records each write's path and body. `write` can answer a write instead. */
async function open(url: string, { role = "admin", write }: { role?: string; write?: (path: string, body: Body) => Response | undefined } = {}) {
  const writes: { path: string; body: Body }[] = [];
  const answer = (status: number, result: (body: Body) => unknown) => async (req: Request) => {
    const path = `${req.method} ${new URL(req.url).pathname}`;
    const body = (req.method === "POST" && path.endsWith("activate") ? {} : await req.json()) as Body;
    writes.push({ path, body });
    return write?.(path, body) ?? Response.json(result(body), { status });
  };
  fakeApi({
    "GET /auth/me": { ...ME, role },
    "GET /company": COMPANY,
    "GET /parties": { total: 0, parties: [], page: 1, page_size: 50 },
    "GET /parties/7": SAVED,
    "POST /parties": answer(201, (b) => ({ ...SAVED, ...b, id: 8 })),
    "PUT /parties/7": answer(200, (b) => ({ ...SAVED, ...b })),
    "POST /parties/7/deactivate": answer(200, () => ({ ...SAVED, active: false })),
    "POST /parties/7/reactivate": answer(200, () => SAVED),
  });
  render(
    <MemoryRouter initialEntries={[url]}>
      <Shell />
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  return { user, writes };
}
const field = (label: string, within_: HTMLElement = document.body) => within(within_).getByRole("textbox", { name: label });
/** An S2 Picker's button is named "<selected value> <label>"; the party's own pickers come before the addresses'. */
const picker = (label: string) => screen.getAllByRole("button", { name: new RegExp(`${label}$`) })[0]!;
async function pick(user: ReturnType<typeof userEvent.setup>, label: string, option: string | RegExp) {
  await user.click(picker(label));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("new party", () => {
  test("a valid GSTIN fills state and PAN; saves in paise with addresses, then back to the list", async () => {
    const { user, writes } = await open("/masters/parties/new");
    await screen.findByRole("heading", { name: "New party" });
    await user.type(field("Name"), "Sharma Steels Pvt Ltd");
    await user.type(field("GSTIN"), DL.toLowerCase());
    expect(picker("State")).toHaveTextContent("07 – Delhi");
    expect(field("PAN")).toHaveValue("AABCS1234A");
    expect(screen.getByText("Delhi. State and PAN come from the GSTIN.")).toBeInTheDocument();

    await user.type(field("Credit limit (₹)"), "5,00,000");
    await user.type(field("Opening balance (₹)"), "123456.78");
    await pick(user, "Balance is", /Cr: we owe them/);
    await user.type(field("City", screen.getByRole("region", { name: "Billing address" })), "New Delhi");
    await user.click(screen.getByRole("button", { name: "Add shipping address" }));
    const ship = screen.getByRole("region", { name: "Shipping address 1" });
    await user.type(field("Label", ship), "Plant 2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: "Parties" })).toBeInTheDocument();
    expect(writes).toHaveLength(1);
    expect(writes[0]!.path).toBe("POST /api/parties");
    expect(writes[0]!.body).toMatchObject({
      name: "Sharma Steels Pvt Ltd", registration_type: "regular", gstin: DL.toLowerCase(), pan: null,
      credit_limit: 5_00_000_00, opening_balance: -1_23_456_78, credit_days: 0,
      addresses: [
        { kind: "billing", label: null, city: "New Delhi", state_code: "06" },
        { kind: "shipping", label: "Plant 2", state_code: "07" }, // new shipping starts in the GSTIN's state
      ],
    });
  });

  test("unregistered: no GSTIN field, state and PAN are typed; an untouched billing address isn't sent", async () => {
    const { user, writes } = await open("/masters/parties/new");
    await user.type(await screen.findByRole("textbox", { name: "Name" }), "Walk-in");
    await pick(user, "GST registration", "Consumer");
    expect(screen.queryByRole("textbox", { name: "GSTIN" })).not.toBeInTheDocument();
    expect(picker("State")).toHaveTextContent("06 – Haryana"); // the company's state
    await pick(user, "State", "07 – Delhi");
    await user.type(field("PAN"), "abcde1234f");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]!.body).toMatchObject({ registration_type: "consumer", gstin: null, state_code: "07", pan: "abcde1234f", opening_balance: 0, credit_limit: null, addresses: [] });
  });

  test("a bad amount is caught before sending", async () => {
    const { user, writes } = await open("/masters/parties/new");
    await user.type(await screen.findByRole("textbox", { name: "Name" }), "X");
    await pick(user, "GST registration", "Consumer"); // so no GSTIN is required
    await user.type(field("Credit limit (₹)"), "five lakh");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter an amount like 25000 or 25,000.50.")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  test("server field errors show inline: duplicate GSTIN (409), a shipping PIN (400)", async () => {
    const reply = Response.json({ error: { code: "CONFLICT", message: "A party with this GSTIN already exists.", details: { fields: { gstin: ["A party with this GSTIN already exists."] } } } }, { status: 409 });
    const { user } = await open("/masters/parties/new", { write: () => reply });
    await user.type(await screen.findByRole("textbox", { name: "Name" }), "Dup");
    await user.type(field("GSTIN"), DL);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("A party with this GSTIN already exists.")).toBeInTheDocument();
    expect(field("GSTIN")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("heading", { name: "New party" })).toBeInTheDocument(); // stayed on the form
  });

  test("a server error on a shipping address lands on that address's field", async () => {
    // No billing address filled, so the first shipping address is addresses.0 in the body.
    const reply = Response.json({ error: { code: "VALIDATION", message: "Some fields are invalid.", details: { fields: { "addresses.0.pincode": ["PIN code is 6 digits."] } } } }, { status: 400 });
    const { user } = await open("/masters/parties/new", { write: () => reply });
    await user.type(await screen.findByRole("textbox", { name: "Name" }), "Pin");
    await user.type(field("GSTIN"), DL);
    await user.click(screen.getByRole("button", { name: "Add shipping address" }));
    const ship = screen.getByRole("region", { name: "Shipping address 1" });
    await user.type(field("PIN code", ship), "123");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await within(ship).findByText("PIN code is 6 digits.")).toBeInTheDocument();
    expect(field("PIN code", ship)).toHaveAttribute("aria-invalid", "true");
    const billing = screen.getByRole("region", { name: "Billing address" });
    expect(within(billing).queryByText("PIN code is 6 digits.")).not.toBeInTheDocument(); // not on the unsent billing address
    expect(field("PIN code", billing)).not.toHaveAttribute("aria-invalid", "true");
  });

  test("keyboard only: type, tab through the pickers, Enter submits", async () => {
    const { user, writes } = await open("/masters/parties/new");
    await screen.findByRole("heading", { name: "New party" });
    expect(field("Name")).toHaveFocus(); // autofocus on a new party
    await user.keyboard("Gupta Traders");
    await user.tab(); // Type
    await user.tab(); // GST registration
    expect(picker("GST registration")).toHaveFocus();
    await user.keyboard("Unr"); // type-ahead picks "Unregistered business" without opening the list
    await waitFor(() => expect(picker("GST registration")).toHaveTextContent("Unregistered business"));
    field("Name").focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]!.body).toMatchObject({ name: "Gupta Traders", registration_type: "unregistered", gstin: null });
  });
});

describe("existing party", () => {
  test("loads every field (balance as Cr) and saves with PUT", async () => {
    const { user, writes } = await open("/masters/parties/7");
    expect(await screen.findByRole("heading", { name: "Sharma Steels Pvt Ltd" })).toBeInTheDocument();
    expect(field("GSTIN")).toHaveValue(DL);
    expect(field("Credit limit (₹)")).toHaveValue("500000.00");
    expect(field("Opening balance (₹)")).toHaveValue("123456.78");
    expect(picker("Balance is")).toHaveTextContent("Cr: we owe them");
    expect(field("Label", screen.getByRole("region", { name: "Shipping address 1" }))).toHaveValue("Plant 2");
    await user.clear(field("Phone"));
    await user.type(field("Phone"), "9999900000");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ path: "PUT /api/parties/7", body: { phone: "9999900000", credit_limit: 5_00_000_00, opening_balance: -1_23_456_78, addresses: [{ kind: "billing" }, { kind: "shipping", label: "Plant 2" }] } });
  });

  test("deactivate, then reactivate", async () => {
    const { user, writes } = await open("/masters/parties/7");
    await user.click(await screen.findByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("Inactive")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reactivate" }));
    await waitFor(() => expect(screen.queryByText("Inactive")).not.toBeInTheDocument());
    expect(writes.map((w) => w.path)).toEqual(["POST /api/parties/7/deactivate", "POST /api/parties/7/reactivate"]);
  });

  test("viewers see it read-only, with no Save or Deactivate", async () => {
    await open("/masters/parties/7", { role: "viewer" });
    await screen.findByRole("heading", { name: "Sharma Steels Pvt Ltd" });
    expect(field("Name")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add shipping address" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to parties" })).toHaveAttribute("href", "/masters/parties");
  });

  test("an unknown party says so", async () => {
    await open("/masters/parties/99");
    expect(await screen.findByText(/couldn't be loaded/)).toBeInTheDocument();
  });
});
