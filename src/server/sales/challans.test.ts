import { describe, expect, test } from "bun:test";
import { createApp } from "../app.ts";
import type { Oidc, Role } from "../auth/oidc.ts";
import { ROLES } from "../auth/oidc.ts";
import { createSession } from "../auth/sessions.ts";
import upsertUser from "../auth/upsert_user.sql";
import { testDb } from "../test/db.ts";

const db = await testDb();
const app = createApp({ db, oidc: {} as Oidc });
const users = Object.fromEntries(
  await Promise.all(ROLES.map(async (role) => [role, (await upsertUser.run(db, { sub: `dc-${role}`, email: null, name: role, role }))!] as const)),
) as unknown as Record<Role, { id: number }>;
const cookies = Object.fromEntries(await Promise.all(ROLES.map(async (role) => [role, `session=${(await createSession(db, users[role].id)).token}`] as const))) as Record<Role, string>;
const request = (base: string) => (method: string, path: string, body?: unknown, role: Role = "accountant") =>
  app.request(`/api/${base}${path}`, {
    method,
    headers: { cookie: cookies[role], ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const challans = request("challans");
const orders = request("sales-orders");
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON for assertions
const json = async (res: Response | Promise<Response>) => (await (await res).json()) as any;

type Row = Record<string, unknown>;
const one = async <T = Row>(sql: Promise<unknown>) => ((await sql) as T[])[0]!;
const { id: co } = await one<{ id: number }>(db`select id from companies order by id limit 1`);
const party = async (name: string) => (await one<{ id: number }>(db`insert into parties (company_id, name, kind, registration_type, state_code) values (${co}, ${name}, 'customer', 'unregistered', '06') returning id`)).id;
const { id: NOS } = await one<{ id: number }>(db`select id from units where code = 'NOS'`);
const { id: G18 } = await one<{ id: number }>(db`select id from gst_rates where rate = 18 limit 1`);
const item = async (code: string) => (await one<{ id: number }>(db`insert into items (company_id, code, name, type, hsn, unit_id, gst_rate_id) values (${co}, ${code}, ${code}, 'finished', '73181500', ${NOS}, ${G18}) returning id`)).id;
const ACME = await party("Acme Castings");
const DELTA = await party("Delta Auto");
const BOLT = await item("DC-BOLT");
const NUT = await item("DC-NUT");

const line = (extra: Row = {}) => ({ item_id: BOLT, qty: 1000, rate: 12_50, gst_rate: 18, ...extra });
const body = (extra: Row = {}) => ({ challan_type: "sale", date: "2026-11-11", party_id: ACME, lines: [line()], ...extra });
/** A confirmed sales order. */
async function confirmedOrder(lines = [line()], party_id = ACME) {
  const so = await json(orders("POST", "", { date: "2026-11-10", party_id, lines }));
  await orders("POST", `/${so.id}/status`, { status: "finalized" });
  return so.id as number;
}

describe("delivery challans", () => {
  test("an operator writes a fresh challan: type, vehicle, transporter, e-way bill, ship-to", async () => {
    const res = await challans("POST", "", body({
      challan_type: "job_work", vehicle_no: "HR 51 AB 1234", transporter: "Faridabad Roadways", eway_bill_no: "3310 0012 3456",
      shipping_address: { label: "Plant 2", address: "Plot 14, Sector 24", city: "Faridabad", pincode: "121005", state_code: "06" },
    }), "operator");
    expect(res.status).toBe(201);
    const dc = await json(res);
    expect(dc).toMatchObject({ type: "challan", number: "DC/26-27/0001", status: "draft", challan_type: "job_work", vehicle_no: "HR 51 AB 1234", transporter: "Faridabad Roadways", eway_bill_no: "331000123456", shipping_address: { label: "Plant 2", city: "Faridabad" } });
    expect(await json(challans("GET", `/${dc.id}`, undefined, "viewer"))).toEqual(dc);
    expect(await json(challans("GET", "?fy=2026&q=DC/26-27/0001", undefined, "operator"))).toMatchObject({ total: 1, challans: [{ id: dc.id }] });
    expect((await challans("PUT", `/${dc.id}`, body({ challan_type: "returnable" }), "operator")).status).toBe(200);
    expect((await json(challans("GET", `/${dc.id}`))).challan_type).toBe("returnable");
  });

  test("the challan type is required and must be one of the four; e-way bill is 12 digits", async () => {
    const fields = async (extra: Row) => (await json(challans("POST", "", body(extra)))).error.details.fields;
    expect(await fields({ challan_type: undefined })).toEqual({ challan_type: ["Choose the challan type."] });
    expect(await fields({ challan_type: "gift" })).toEqual({ challan_type: ["Choose the challan type."] });
    expect(await fields({ eway_bill_no: "1234" })).toEqual({ eway_bill_no: ["E-way bill number is 12 digits."] });
  });

  test("from a confirmed order: /new fills a sale challan; deliveries draw down the order's pending qty", async () => {
    const so = await confirmedOrder([line(), line({ item_id: NUT, qty: 500, rate: 3_00 })]);
    const order = await json(orders("GET", `/${so}`));
    const draft = await json(challans("GET", `/new?from=${so}`, undefined, "operator"));
    expect(draft).toMatchObject({ type: "challan", challan_type: "sale", party_id: ACME, lines: order.lines.map((l: Row) => ({ item_id: l.item_id, qty: l.qty, from_line_id: l.id })) });

    // 600 bolts go today; the nuts later.
    const dc = await json(challans("POST", "", { ...draft, vehicle_no: "HR 51 AB 1234", lines: [{ ...draft.lines[0], qty: 600 }] }, "operator"));
    expect(dc.lines).toMatchObject([{ qty: 600, from_line_id: order.lines[0].id }]);
    const after = await json(orders("GET", `/${so}`));
    expect(after.status).toBe("finalized"); // an order stays confirmed; only quotations become accepted
    expect(after.lines.map((l: Row) => l.pending)).toEqual([400, 500]);

    const rest = await json(challans("GET", `/new?from=${so}`));
    expect(rest.lines.map((l: Row) => [l.item_id, l.qty])).toEqual([[BOLT, 400], [NUT, 500]]);
    const over = await challans("POST", "", { ...rest, lines: [{ ...rest.lines[0], qty: 401 }] });
    expect(over.status).toBe(400);
    expect((await json(over)).error.details.fields).toEqual({ "lines.0.qty": [`Only 400 NOS of line 1 of the sales order ${order.number} is still pending.`] });

    // Cancelling the challan gives its qty back to the order.
    await challans("POST", `/${dc.id}/status`, { status: "finalized" }, "operator");
    expect((await json(challans("POST", `/${dc.id}/status`, { status: "cancelled" }, "operator"))).status).toBe("cancelled");
    expect((await json(orders("GET", `/${so}`))).lines.map((l: Row) => l.pending)).toEqual([1000, 500]);
  });

  test("/new refuses draft orders and quotations; viewers can't make challans", async () => {
    const draftSo = await json(orders("POST", "", { date: "2026-11-10", party_id: ACME, lines: [line()] }));
    const res = await challans("GET", `/new?from=${draftSo.id}`);
    expect(res.status).toBe(400);
    expect((await json(res)).error.details.fields.source_ids).toEqual([`${draftSo.number} is draft.`]);
    const q = await json(request("quotations")("POST", "", { date: "2026-11-10", party_id: ACME, lines: [line()] }));
    expect((await json(challans("GET", `/new?from=${q.id}`))).error.details.fields.source_ids).toEqual(["Choose documents a challan is made from."]);
    const so = await confirmedOrder();
    const theirs = await confirmedOrder(undefined, DELTA);
    expect((await json(challans("GET", `/new?from=${so},${theirs}`))).error.details.fields.source_ids).toEqual(["Choose documents for one party."]);
    expect((await challans("GET", `/new?from=${so}`, undefined, "viewer")).status).toBe(403);
    expect((await challans("POST", "", body(), "viewer")).status).toBe(403);
  });

  test("status: Draft → Finalized → Cancelled; a finalized challan can't be edited", async () => {
    const dc = await json(challans("POST", "", body()));
    expect((await json(challans("POST", `/${dc.id}/status`, { status: "finalized" }, "operator"))).status).toBe("finalized");
    expect((await challans("PUT", `/${dc.id}`, body(), "operator")).status).toBe(409);
    expect((await json(challans("POST", `/${dc.id}/status`, { status: "draft" }))).error.message).toBe("A finalized challan can be marked cancelled, not draft.");
    expect((await challans("POST", `/${dc.id}/status`, { status: "sent" })).status).toBe(400);
    expect((await challans("POST", `/${dc.id}/status`, { status: "cancelled" }, "viewer")).status).toBe(403);
  });
});
