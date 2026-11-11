import { describe, expect, test } from "bun:test";
import { documentInput } from "../../shared/schemas/document.ts";
import { createApp } from "../app.ts";
import type { Oidc, Role } from "../auth/oidc.ts";
import { ROLES } from "../auth/oidc.ts";
import { createSession } from "../auth/sessions.ts";
import upsertUser from "../auth/upsert_user.sql";
import { saveDocument } from "../documents/service.ts";
import { testDb } from "../test/db.ts";

const db = await testDb();
const app = createApp({ db, oidc: {} as Oidc });
const users = Object.fromEntries(
  await Promise.all(ROLES.map(async (role) => [role, (await upsertUser.run(db, { sub: `po-${role}`, email: null, name: role, role }))!] as const)),
) as unknown as Record<Role, { id: number }>;
const cookies = Object.fromEntries(await Promise.all(ROLES.map(async (role) => [role, `session=${(await createSession(db, users[role].id)).token}`] as const))) as Record<Role, string>;
const request = (base: string) => (method: string, path: string, body?: unknown, role: Role = "accountant") =>
  app.request(`/api/${base}${path}`, {
    method,
    headers: { cookie: cookies[role], ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const orders = request("purchase-orders");
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON for assertions
const json = async (res: Response | Promise<Response>) => (await (await res).json()) as any;

type Row = Record<string, unknown>;
const one = async <T = Row>(sql: Promise<unknown>) => ((await sql) as T[])[0]!;
const { id: co } = await one<{ id: number }>(db`select id from companies order by id limit 1`);
const party = async (name: string, state = "06") => (await one<{ id: number }>(db`insert into parties (company_id, name, kind, registration_type, state_code) values (${co}, ${name}, 'supplier', 'unregistered', ${state}) returning id`)).id;
const { id: NOS } = await one<{ id: number }>(db`select id from units where code = 'NOS'`);
const { id: G18 } = await one<{ id: number }>(db`select id from gst_rates where rate = 18 limit 1`);
const item = async (code: string) => (await one<{ id: number }>(db`insert into items (company_id, code, name, type, hsn, unit_id, gst_rate_id) values (${co}, ${code}, ${code}, 'finished', '73181500', ${NOS}, ${G18}) returning id`)).id;
const STEEL = await party("Haryana Steel Traders"); // local: CGST + SGST
const DELHI = await party("Okhla Wire Mills", "07"); // out of state: IGST
const ROD = await item("PO-ROD");
const WIRE = await item("PO-WIRE");

const body = (extra: Row = {}) => ({ date: "2026-11-11", party_id: STEEL, lines: [{ item_id: ROD, qty: 1000, rate: 74_20, gst_rate: 18 }], ...extra });

describe("purchase orders", () => {
  test("a PO with delivery date, terms and the supplier's quotation; numbered PO/…; each line fully pending", async () => {
    const res = await orders("POST", "", body({ due_date: "2026-11-25", terms: "Delivery at our works, Sector 24. Payment 30 days.", party_ref: "HST/Q/118", party_ref_date: "2026-11-05", vehicle_no: "HR 51 AB 1234" }));
    expect(res.status).toBe(201);
    const po = await json(res);
    expect(po).toMatchObject({
      type: "purchase_order", status: "draft", number: expect.stringMatching(/^PO\/26-27\/\d+$/), due_date: "2026-11-25", terms: "Delivery at our works, Sector 24. Payment 30 days.",
      party_ref: "HST/Q/118", party_ref_date: "2026-11-05", vehicle_no: null, challan_type: null, note_reason: null, place_of_supply: "06",
      taxable_total: 74_200_00, cgst_total: 6_678_00, sgst_total: 6_678_00, igst_total: 0, grand_total: 87_556_00,
    });
    expect(po.lines).toMatchObject([{ qty: 1000, pending: 1000, from_line_id: null }]);
    expect(await json(orders("GET", `/${po.id}`, undefined, "viewer"))).toEqual(po);
    expect(await json(orders("GET", "?fy=2026&q=Haryana%20Steel"))).toMatchObject({ total: 1, purchase_orders: [{ id: po.id, due_date: "2026-11-25", ordered_qty: 1000, pending_qty: 1000 }] });
  });

  test("an out-of-state supplier: the goods come to Haryana, so IGST", async () => {
    const po = await json(orders("POST", "", body({ party_id: DELHI })));
    expect(po).toMatchObject({ party_state_code: "07", place_of_supply: "06", cgst_total: 0, sgst_total: 0, igst_total: 13_356_00 });
  });

  test("edit while draft; Draft → Finalized → Cancelled; a finalized PO is locked", async () => {
    const po = await json(orders("POST", "", body()));
    const edited = await json(orders("PUT", `/${po.id}`, body({ due_date: "2026-12-01", lines: [{ item_id: ROD, qty: 1000, rate: 74_20, gst_rate: 18 }, { item_id: WIRE, qty: 250_000, rate: 88_00, gst_rate: 18 }] })));
    expect(edited).toMatchObject({ number: po.number, due_date: "2026-12-01", lines: [{ item_id: ROD }, { item_id: WIRE, qty: 250_000 }] });
    expect((await json(orders("POST", `/${po.id}/status`, { status: "finalized" }))).status).toBe("finalized");
    expect((await orders("PUT", `/${po.id}`, body())).status).toBe(409);
    expect((await json(orders("POST", `/${po.id}/status`, { status: "draft" }))).error.message).toBe("A finalized purchase order can be marked cancelled, not draft.");
    expect((await json(orders("POST", `/${po.id}/status`, { status: "cancelled" }))).status).toBe("cancelled");
  });

  test("GRNs and purchase bills draw on its pending qty; never more than ordered; not before it's finalized", async () => {
    const po = await json(orders("POST", "", body()));
    const grn = (qty: number) => documentInput.parse({ type: "grn", date: "2026-11-20", party_id: STEEL, lines: [{ item_id: ROD, qty, rate: 74_20, gst_rate: 18, from_line_id: po.lines[0].id }] });
    await expect(saveDocument(db, { companyId: co, userId: users.accountant.id, doc: grn(600) })).rejects.toThrow(/Some lines take more/); // still a draft
    await orders("POST", `/${po.id}/status`, { status: "finalized" });
    await saveDocument(db, { companyId: co, userId: users.accountant.id, doc: grn(600) });
    expect((await json(orders("GET", `/${po.id}`))).lines[0].pending).toBe(400);
    expect((await json(orders("GET", "?fy=2026&q=Haryana%20Steel"))).purchase_orders.find((r: Row) => r.id === po.id)).toMatchObject({ ordered_qty: 1000, pending_qty: 400 });
    await expect(saveDocument(db, { companyId: co, userId: users.accountant.id, doc: grn(401) })).rejects.toThrow(/Some lines take more/);
    const bill = documentInput.parse({ type: "purchase_bill", date: "2026-11-21", party_id: STEEL, lines: [{ item_id: ROD, qty: 400, rate: 74_20, gst_rate: 18, from_line_id: po.lines[0].id }] });
    await saveDocument(db, { companyId: co, userId: users.accountant.id, doc: bill });
    expect((await json(orders("GET", `/${po.id}`))).lines[0].pending).toBe(0);
  });

  test("a PO isn't made from other documents; validation; roles", async () => {
    expect((await orders("GET", "/new?from=1")).status).toBe(404);
    const bad = await orders("POST", "", body({ lines: [] }));
    expect(bad.status).toBe(400);
    expect((await json(bad)).error.details.fields).toEqual({ lines: ["Add at least one line."] });
    for (const role of ["operator", "viewer"] as const) {
      expect((await orders("POST", "", body(), role)).status).toBe(403);
      expect((await orders("GET", "?fy=2026", undefined, role)).status).toBe(200);
    }
    expect((await orders("POST", "", body(), "admin")).status).toBe(201);
  });
});
