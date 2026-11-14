import { expect, test } from "bun:test";
import { createApp } from "../app.ts";
import type { Oidc } from "../auth/oidc.ts";
import { createSession } from "../auth/sessions.ts";
import upsertUser from "../auth/upsert_user.sql";
import { testDb } from "../test/db.ts";

const db = await testDb();
const app = createApp({ db, oidc: {} as Oidc });
const user = (await upsertUser.run(db, { sub: "dash-accountant", email: null, name: "accountant", role: "accountant" }))!;
const cookie = `session=${(await createSession(db, user.id)).token}`;
const call = (method: string, path: string, body?: unknown) =>
  app.request(`/api${path}`, { method, headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON for assertions
const json = async (res: Response | Promise<Response>) => (await (await res).json()) as any;

type Row = Record<string, unknown>;
const one = async <T = Row>(sql: Promise<unknown>) => ((await sql) as T[])[0]!;
const { id: co } = await one<{ id: number }>(db`select id from companies order by id limit 1`);
const party = async (name: string) => (await one<{ id: number }>(db`insert into parties (company_id, name, kind, registration_type, state_code) values (${co}, ${name}, 'customer', 'unregistered', '06') returning id`)).id;
const { id: NOS } = await one<{ id: number }>(db`select id from units where code = 'NOS'`);
const { id: G18 } = await one<{ id: number }>(db`select id from gst_rates where rate = 18 limit 1`);
const BOLT = (await one<{ id: number }>(db`insert into items (company_id, code, name, type, hsn, unit_id, gst_rate_id) values (${co}, 'DASH-BOLT', 'Bolt', 'finished', '73181500', ${NOS}, ${G18}) returning id`)).id;
const ACME = await party("Acme Castings");
const DELTA = await party("Delta Auto");

const doc = async (path: string, date: string, party_id: number, qty: number, status?: string) => {
  const d = await json(call("POST", path, { date, party_id, lines: [{ item_id: BOLT, qty, rate: 10_00, gst_rate: 18 }] }));
  return status ? json(call("POST", `${path}/${d.id}/status`, { status })) : d;
};

test("dashboard: net sales by month less credit notes, output GST, open work, top customers, recent", async () => {
  const empty = await json(call("GET", "/dashboard?fy=2026"));
  expect(empty).toMatchObject({ net_sales: 0, output_gst: 0, invoice_count: 0, draft_invoices: 0, top_customers: [], recent: [] });
  expect(empty.monthly.map((m: Row) => m.month)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]);

  const big = await doc("/invoices", "2026-11-11", ACME, 100, "finalized"); // ₹1,000 + 18%
  await doc("/invoices", "2026-05-02", DELTA, 30, "finalized"); // ₹300
  await doc("/invoices", "2026-11-12", DELTA, 999); // a draft: not a sale
  const draft = await json(call("GET", `/credit-notes/new?from=${big.id}`));
  const cn = await json(call("POST", "/credit-notes", { ...draft, lines: [{ ...draft.lines[0], qty: 20 }] })); // ₹200 back
  await json(call("POST", `/credit-notes/${cn.id}/status`, { status: "finalized" }));
  await doc("/quotations", "2026-11-01", ACME, 5, "sent");
  await doc("/sales-orders", "2026-11-01", ACME, 7, "finalized"); // nothing delivered yet
  await doc("/invoices", "2025-11-11", ACME, 1000, "finalized"); // last FY

  const d = await json(call("GET", "/dashboard?fy=2026"));
  expect(d).toMatchObject({
    net_sales: 1_100_00, output_gst: 198_00, invoice_count: 2, draft_invoices: 1,
    quotes_awaiting: 1, quotes_awaiting_value: 59_00, orders_to_deliver: 1, pos_to_receive: 0,
    top_customers: [{ party_id: ACME, party_name: "Acme Castings", net_sales: 800_00 }, { party_id: DELTA, party_name: "Delta Auto", net_sales: 300_00 }],
  });
  expect(d.monthly.find((m: Row) => m.month === "2026-11").net_sales).toBe(800_00);
  expect(d.monthly.find((m: Row) => m.month === "2026-05").net_sales).toBe(300_00);
  expect(d.recent).toHaveLength(6);
  expect(d.recent[0]).toMatchObject({ type: "invoice", status: "draft", party_name: "Delta Auto" });
});

test("dashboard: fy is required", async () => {
  expect((await call("GET", "/dashboard")).status).toBe(400);
});
