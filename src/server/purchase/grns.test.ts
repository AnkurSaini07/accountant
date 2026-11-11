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
  await Promise.all(ROLES.map(async (role) => [role, (await upsertUser.run(db, { sub: `grn-${role}`, email: null, name: role, role }))!] as const)),
) as unknown as Record<Role, { id: number }>;
const cookies = Object.fromEntries(await Promise.all(ROLES.map(async (role) => [role, `session=${(await createSession(db, users[role].id)).token}`] as const))) as Record<Role, string>;
const request = (base: string) => (method: string, path: string, body?: unknown, role: Role = "accountant") =>
  app.request(`/api/${base}${path}`, {
    method,
    headers: { cookie: cookies[role], ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const orders = request("purchase-orders");
const grns = request("grns");
const invoices = request("invoices");
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON for assertions
const json = async (res: Response | Promise<Response>) => (await (await res).json()) as any;

type Row = Record<string, unknown>;
const one = async <T = Row>(sql: Promise<unknown>) => ((await sql) as T[])[0]!;
const { id: co } = await one<{ id: number }>(db`select id from companies order by id limit 1`);
const party = async (name: string, state = "06") => (await one<{ id: number }>(db`insert into parties (company_id, name, kind, registration_type, state_code) values (${co}, ${name}, 'supplier', 'unregistered', ${state}) returning id`)).id;
const { id: NOS } = await one<{ id: number }>(db`select id from units where code = 'NOS'`);
const { id: G18 } = await one<{ id: number }>(db`select id from gst_rates where rate = 18 limit 1`);
const item = async (code: string) => (await one<{ id: number }>(db`insert into items (company_id, code, name, type, hsn, unit_id, gst_rate_id) values (${co}, ${code}, ${code}, 'finished', '73181500', ${NOS}, ${G18}) returning id`)).id;
const STEEL = await party("Haryana Steel Traders");
const OTHER = await party("Faridabad Fasteners");
const ROD = await item("GRN-ROD");
const WIRE = await item("GRN-WIRE");
const line = (extra: Row = {}) => ({ item_id: ROD, qty: 1000, rate: 74_20, gst_rate: 18, ...extra });
const err = async (res: Response | Promise<Response>) => (await json(res)).error;

/** A PO sent to the supplier: 1000 rods and 500 wire. */
const sentPo = async () => {
  const po = await json(orders("POST", "", { date: "2026-11-11", party_id: STEEL, lines: [line(), line({ item_id: WIRE, qty: 500, rate: 88_00 })] }));
  return json(orders("POST", `/${po.id}/status`, { status: "finalized" }));
};

describe("GRNs", () => {
  test("from a PO: its pending lines; the supplier's challan; accepted comes off the PO, rejected doesn't", async () => {
    const po = await sentPo();
    const draft = await json(grns("GET", `/new?from=${po.id}`));
    expect(draft.lines.map((l: Row) => [l.item_id, l.qty, l.from_line_id])).toEqual([[ROD, 1000, po.lines[0].id], [WIRE, 500, po.lines[1].id]]);
    // 1000 rods came in, 50 failed inspection; the wire comes later.
    const res = await grns("POST", "", { ...draft, party_ref: "HST/DC/2231", party_ref_date: "2026-11-20", vehicle_no: "HR 51 AB 1234", lines: [{ ...draft.lines[0], qty: 950, rejected_qty: 50 }] });
    expect(res.status).toBe(201);
    const grn = await json(res);
    expect(grn).toMatchObject({ type: "grn", status: "draft", number: expect.stringMatching(/^GRN\//), party_ref: "HST/DC/2231", party_ref_date: "2026-11-20", vehicle_no: "HR 51 AB 1234", place_of_supply: "06", taxable_total: 70_490_00 });
    expect(grn.lines).toMatchObject([{ qty: 950, rejected_qty: 50, from_line_id: po.lines[0].id }]);
    expect((await json(orders("GET", `/${po.id}`))).lines.map((l: Row) => l.pending)).toEqual([50, 500]); // the 50 rejected are still owed
    // The rest of the PO: the 50 replacements and the wire.
    const rest = await json(grns("GET", `/new?from=${po.id}`));
    expect(rest.lines.map((l: Row) => [l.item_id, l.qty])).toEqual([[ROD, 50], [WIRE, 500]]);
  });

  test("never more accepted than the PO has pending; rejected doesn't count against it", async () => {
    const po = await sentPo();
    const draft = await json(grns("GET", `/new?from=${po.id}`));
    const over = await grns("POST", "", { ...draft, lines: [{ ...draft.lines[0], qty: 1001 }] });
    expect((await err(over)).details.fields).toEqual({ "lines.0.qty": [`Only 1000 NOS of line 1 of the purchase order ${po.number} is still pending.`] });
    expect((await grns("POST", "", { ...draft, lines: [{ ...draft.lines[0], qty: 1000, rejected_qty: 200 }] })).status).toBe(201); // 1200 came, 1000 kept
    expect((await json(orders("GET", `/${po.id}`))).lines[0].pending).toBe(0);
  });

  test("fresh, without a PO; finalize locks it; cancelling puts the qty back on the PO", async () => {
    const fresh = await json(grns("POST", "", { date: "2026-11-20", party_id: OTHER, party_ref: "FF/88", lines: [line({ qty: 10 })] }));
    expect(fresh).toMatchObject({ party_ref: "FF/88", lines: [{ qty: 10, rejected_qty: 0, from_line_id: null }] });

    const po = await sentPo();
    const grn = await json(grns("POST", "", await json(grns("GET", `/new?from=${po.id}`))));
    await grns("POST", `/${grn.id}/status`, { status: "finalized" });
    expect((await grns("PUT", `/${grn.id}`, { date: "2026-11-20", party_id: STEEL, lines: [line()] })).status).toBe(409);
    expect((await json(orders("GET", `/${po.id}`))).lines.map((l: Row) => l.pending)).toEqual([0, 0]);
    expect((await json(grns("POST", `/${grn.id}/status`, { status: "cancelled" }))).status).toBe("cancelled");
    expect((await json(orders("GET", `/${po.id}`))).lines.map((l: Row) => l.pending)).toEqual([1000, 500]);
  });

  test("only GRNs record rejected qty; a GRN isn't made from a draft PO or another supplier's", async () => {
    const inv = await invoices("POST", "", { date: "2026-11-11", party_id: STEEL, lines: [line({ rejected_qty: 5 })] });
    expect((await err(inv)).details.fields).toEqual({ "lines.0.rejected_qty": ["Only GRNs record rejected qty."] });
    const neg = await grns("POST", "", { date: "2026-11-20", party_id: STEEL, lines: [line({ rejected_qty: -1 })] });
    expect((await err(neg)).details.fields).toEqual({ "lines.0.rejected_qty": ["Can't be negative."] });
    const draftPo = await json(orders("POST", "", { date: "2026-11-11", party_id: STEEL, lines: [line()] }));
    expect((await err(grns("GET", `/new?from=${draftPo.id}`))).message).toBe(`The purchase order ${draftPo.number} is draft, so it can't be converted.`);
    const po = await sentPo();
    const wrong = await grns("POST", "", { ...(await json(grns("GET", `/new?from=${po.id}`))), party_id: OTHER });
    expect((await err(wrong)).details.fields["lines.0.from_line_id"]).toEqual([`The purchase order ${po.number} is for another party.`]);
  });

  test("roles: stores (operators) record GRNs, as they do challans; viewers only read", async () => {
    expect((await grns("POST", "", { date: "2026-11-20", party_id: STEEL, lines: [line()] }, "operator")).status).toBe(201);
    expect((await grns("POST", "", { date: "2026-11-20", party_id: STEEL, lines: [line()] }, "viewer")).status).toBe(403);
    expect((await grns("GET", "?fy=2026", undefined, "viewer")).status).toBe(200);
  });
});
