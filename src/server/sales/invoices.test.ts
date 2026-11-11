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
  await Promise.all(ROLES.map(async (role) => [role, (await upsertUser.run(db, { sub: `inv-${role}`, email: null, name: role, role }))!] as const)),
) as unknown as Record<Role, { id: number }>;
const cookies = Object.fromEntries(await Promise.all(ROLES.map(async (role) => [role, `session=${(await createSession(db, users[role].id)).token}`] as const))) as Record<Role, string>;
const request = (base: string) => (method: string, path: string, body?: unknown, role: Role = "accountant") =>
  app.request(`/api/${base}${path}`, {
    method,
    headers: { cookie: cookies[role], ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const invoices = request("invoices");
const challans = request("challans");
const orders = request("sales-orders");
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON for assertions
const json = async (res: Response | Promise<Response>) => (await (await res).json()) as any;

type Row = Record<string, unknown>;
const one = async <T = Row>(sql: Promise<unknown>) => ((await sql) as T[])[0]!;
const { id: co } = await one<{ id: number }>(db`select id from companies order by id limit 1`);
const party = async (name: string, state = "06") => (await one<{ id: number }>(db`insert into parties (company_id, name, kind, registration_type, state_code) values (${co}, ${name}, 'customer', 'unregistered', ${state}) returning id`)).id;
const { id: NOS } = await one<{ id: number }>(db`select id from units where code = 'NOS'`);
const { id: G18 } = await one<{ id: number }>(db`select id from gst_rates where rate = 18 limit 1`);
const item = async (code: string) => (await one<{ id: number }>(db`insert into items (company_id, code, name, type, hsn, unit_id, gst_rate_id) values (${co}, ${code}, ${code}, 'finished', '73181500', ${NOS}, ${G18}) returning id`)).id;
const ACME = await party("Acme Castings");
const DELTA = await party("Delta Auto", "07"); // Delhi
const BOLT = await item("INV-BOLT");
const NUT = await item("INV-NUT");

const line = (extra: Row = {}) => ({ item_id: BOLT, qty: 1000, rate: 12_50, gst_rate: 18, ...extra });
const body = (extra: Row = {}) => ({ date: "2026-11-11", party_id: ACME, lines: [line()], ...extra });
async function confirmedOrder(lines = [line()], party_id = ACME) {
  const so = await json(orders("POST", "", { date: "2026-11-10", party_id, lines }));
  await orders("POST", `/${so.id}/status`, { status: "finalized" });
  return json(orders("GET", `/${so.id}`));
}

describe("tax invoices (drafts)", () => {
  test("a local sale: CGST + SGST; unregistered customer without GSTIN; anyone reads it", async () => {
    const res = await invoices("POST", "", body({ reverse_charge: true, vehicle_no: "HR 51 AB 1234", eway_bill_no: "3310 0012 3456", challan_type: "sale" }));
    expect(res.status).toBe(201);
    const inv = await json(res);
    expect(inv).toMatchObject({
      type: "invoice", number: "INV/26-27/0001", status: "draft", party_gstin: null, place_of_supply: "06", reverse_charge: true,
      vehicle_no: "HR 51 AB 1234", eway_bill_no: "331000123456", challan_type: null, // a challan's type isn't an invoice's
      taxable_total: 12_500_00, cgst_total: 1_125_00, sgst_total: 1_125_00, igst_total: 0, grand_total: 14_750_00,
    });
    expect(await json(invoices("GET", `/${inv.id}`, undefined, "viewer"))).toEqual(inv);
    expect(await json(invoices("GET", "?fy=2026&q=INV/26-27/0001"))).toMatchObject({ total: 1, invoices: [{ id: inv.id }] });
  });

  test("inter-state: a Delhi customer pays IGST; so does a local customer shipped to Delhi; place of supply can be set", async () => {
    const delhi = await json(invoices("POST", "", body({ party_id: DELTA })));
    expect(delhi).toMatchObject({ place_of_supply: "07", cgst_total: 0, sgst_total: 0, igst_total: 2_250_00, grand_total: 14_750_00 });
    const shipped = await json(invoices("POST", "", body({ shipping_address: { label: "Okhla", address: "B-12", city: "New Delhi", pincode: "110020", state_code: "07" } })));
    expect(shipped).toMatchObject({ place_of_supply: "07", igst_total: 2_250_00, cgst_total: 0 });
    const set = await json(invoices("POST", "", body({ party_id: DELTA, place_of_supply: "06" })));
    expect(set).toMatchObject({ place_of_supply: "06", cgst_total: 1_125_00, igst_total: 0 });
    // Editing a draft recomputes: moving the ship-to back home brings CGST + SGST back.
    const back = await json(invoices("PUT", `/${shipped.id}`, body()));
    expect(back).toMatchObject({ place_of_supply: "06", cgst_total: 1_125_00, igst_total: 0 });
  });

  test("from a challan: /new fills it, saving links the lines; the challan can't be invoiced twice", async () => {
    const so = await confirmedOrder();
    const dcDraft = await json(challans("GET", `/new?from=${so.id}`));
    const dc = await json(challans("POST", "", { ...dcDraft, vehicle_no: "HR 51 AB 1234", lines: [{ ...dcDraft.lines[0], qty: 600 }] }));
    await challans("POST", `/${dc.id}/status`, { status: "finalized" });

    const draft = await json(invoices("GET", `/new?from=${dc.id}`));
    expect(draft).toMatchObject({ type: "invoice", party_id: ACME, challan_type: null, lines: [{ item_id: BOLT, qty: 600, rate: 12_50, from_line_id: dc.lines[0].id }] });
    const inv = await json(invoices("POST", "", draft));
    expect(inv.lines).toMatchObject([{ qty: 600, from_line_id: dc.lines[0].id }]);
    expect((await json(challans("GET", `/${dc.id}`))).lines[0].pending).toBe(0);
    const again = await invoices("GET", `/new?from=${dc.id}`);
    expect(again.status).toBe(400);
    expect((await json(again)).error.details.fields.source_ids).toEqual(["Everything on them has been converted already."]);

    // The order's other 400 can be invoiced straight from the order; then nothing is left anywhere.
    const rest = await json(invoices("GET", `/new?from=${so.id}`));
    expect(rest.lines.map((l: Row) => l.qty)).toEqual([400]);
    expect((await invoices("POST", "", { ...rest, lines: [{ ...rest.lines[0], qty: 401 }] })).status).toBe(400);
    expect((await invoices("POST", "", rest)).status).toBe(201);
    expect((await json(orders("GET", `/${so.id}`))).lines[0].pending).toBe(0);
  });

  test("from several challans of one customer; not from draft challans or another customer's", async () => {
    const so = await confirmedOrder([line(), line({ item_id: NUT, qty: 500, rate: 3_00 })]);
    const issued = async (lines: Row[]) => {
      const dc = await json(challans("POST", "", { challan_type: "sale", date: "2026-11-12", party_id: ACME, lines }));
      await challans("POST", `/${dc.id}/status`, { status: "finalized" });
      return dc.id as number;
    };
    const a = await issued([line({ from_line_id: so.lines[0].id })]);
    const b = await issued([line({ item_id: NUT, qty: 500, rate: 3_00, from_line_id: so.lines[1].id })]);
    const draft = await json(invoices("GET", `/new?from=${a},${b}`));
    expect(draft.lines.map((l: Row) => [l.item_id, l.qty])).toEqual([[BOLT, 1000], [NUT, 500]]);

    const dcDraft = await json(challans("POST", "", { challan_type: "sale", date: "2026-11-12", party_id: ACME, lines: [line()] }));
    expect((await json(invoices("GET", `/new?from=${dcDraft.id}`))).error.details.fields.source_ids).toEqual([`${dcDraft.number} is draft.`]);
    const theirs = await json(challans("POST", "", { challan_type: "sale", date: "2026-11-12", party_id: DELTA, lines: [line()] }));
    await challans("POST", `/${theirs.id}/status`, { status: "finalized" });
    expect((await json(invoices("GET", `/new?from=${a},${theirs.id}`))).error.details.fields.source_ids).toEqual(["Choose documents for one party."]);
  });

  test("operators and viewers read but can't write", async () => {
    for (const role of ["operator", "viewer"] as const) {
      expect((await invoices("POST", "", body(), role)).status).toBe(403);
      expect((await invoices("GET", "?fy=2026", undefined, role)).status).toBe(200);
    }
  });
});
