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
  await Promise.all(ROLES.map(async (role) => [role, (await upsertUser.run(db, { sub: `so-${role}`, email: null, name: role, role }))!] as const)),
) as unknown as Record<Role, { id: number }>;
const cookies = Object.fromEntries(await Promise.all(ROLES.map(async (role) => [role, `session=${(await createSession(db, users[role].id)).token}`] as const))) as Record<Role, string>;
const request = (base: string) => (method: string, path: string, body?: unknown, role: Role = "accountant") =>
  app.request(`/api/${base}${path}`, {
    method,
    headers: { cookie: cookies[role], ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const orders = request("sales-orders");
const quotations = request("quotations");
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
const BOLT = await item("SO-BOLT");
const NUT = await item("SO-NUT");

const body = (extra: Row = {}) => ({ date: "2026-11-11", party_id: ACME, lines: [{ item_id: BOLT, qty: 1000, rate: 12_50, gst_rate: 18 }], ...extra });
/** A quotation, sent to the customer. */
async function sentQuotation(lines = [{ item_id: BOLT, qty: 1000, rate: 12_50, gst_rate: 18 }], party_id = ACME) {
  const q = await json(quotations("POST", "", body({ party_id, lines })));
  await quotations("POST", `/${q.id}/status`, { status: "sent" });
  return q.id as number;
}

describe("sales orders", () => {
  test("a fresh order with the customer's PO; each line starts fully pending; anyone reads it", async () => {
    const res = await orders("POST", "", body({ party_ref: "ACME/PO/4471", party_ref_date: "2026-11-08", challan_type: "sale" }));
    expect(res.status).toBe(201);
    const so = await json(res);
    expect(so).toMatchObject({ type: "sales_order", number: "SO/26-27/0001", status: "draft", party_ref: "ACME/PO/4471", party_ref_date: "2026-11-08", challan_type: null, grand_total: 14_750_00 });
    expect(so.lines).toMatchObject([{ qty: 1000, pending: 1000, from_line_id: null }]);
    expect(await json(orders("GET", `/${so.id}`, undefined, "viewer"))).toEqual(so);
    const list = await json(orders("GET", "?fy=2026&q=ACME"));
    expect(list).toMatchObject({ total: 1, page: 1, sales_orders: [{ id: so.id, number: "SO/26-27/0001" }] });
  });

  test("from a quotation: /new fills the draft, saving it links the lines and marks the quotation accepted", async () => {
    const q = await sentQuotation([{ item_id: BOLT, qty: 1000, rate: 12_50, gst_rate: 18 }, { item_id: NUT, qty: 500, rate: 3_00, gst_rate: 18 }]);
    const quote = await json(quotations("GET", `/${q}`));
    const draft = await json(orders("GET", `/new?from=${q}`));
    expect(draft).toMatchObject({ type: "sales_order", party_id: ACME, lines: quote.lines.map((l: Row) => ({ item_id: l.item_id, qty: l.qty, rate: l.rate, from_line_id: l.id })) });

    // Partly ordered: 600 bolts now, no nuts.
    const so = await json(orders("POST", "", { ...draft, party_ref: "PO-1", lines: [{ ...draft.lines[0], qty: 600 }] }));
    expect(so.lines).toMatchObject([{ qty: 600, from_line_id: quote.lines[0].id }]);
    const after = await json(quotations("GET", `/${q}`));
    expect(after.status).toBe("accepted");
    expect(after.lines.map((l: Row) => l.pending)).toEqual([400, 500]);

    // The next order from it gets what's left, and can't take more.
    const rest = await json(orders("GET", `/new?from=${q}`));
    expect(rest.lines.map((l: Row) => [l.item_id, l.qty])).toEqual([[BOLT, 400], [NUT, 500]]);
    const over = await orders("POST", "", { ...rest, lines: [{ ...rest.lines[0], qty: 401 }] });
    expect(over.status).toBe(400);
    expect((await json(over)).error.details.fields).toEqual({ "lines.0.qty": [`Only 400 NOS of line 1 of the quotation ${quote.number} is still pending.`] });
  });

  test("from several quotations of one customer at once", async () => {
    const a = await sentQuotation();
    const b = await sentQuotation([{ item_id: NUT, qty: 200, rate: 3_00, gst_rate: 18 }]);
    const draft = await json(orders("GET", `/new?from=${a},${b}`));
    expect(draft.lines.map((l: Row) => [l.item_id, l.qty])).toEqual([[BOLT, 1000], [NUT, 200]]);
    expect((await orders("POST", "", draft)).status).toBe(201);
    for (const id of [a, b]) expect((await json(quotations("GET", `/${id}`))).status).toBe("accepted");
  });

  test("/new refuses drafts, rejected quotations, two customers, and documents an order isn't made from", async () => {
    const draftQ = await json(quotations("POST", "", body()));
    const rejected = await sentQuotation();
    await quotations("POST", `/${rejected}/status`, { status: "rejected" });
    const other = await sentQuotation(undefined, DELTA);
    const mine = await sentQuotation();
    const so = await json(orders("POST", "", body()));
    const fields = async (q: string) => {
      const res = await orders("GET", `/new?from=${q}`);
      expect(res.status).toBe(400);
      return (await json(res)).error.details.fields.source_ids;
    };
    expect(await fields(String(draftQ.id))).toEqual([`${draftQ.number} is draft.`]);
    expect(await fields(String(rejected))).toEqual([expect.stringMatching(/ is rejected\.$/)]);
    expect(await fields(`${mine},${other}`)).toEqual(["Choose documents for one party."]);
    expect(await fields(String(so.id))).toEqual(["Choose documents a sales order is made from."]);
    expect((await orders("GET", "/new?from=1,x")).status).toBe(400);
    expect((await quotations("GET", `/new?from=${mine}`)).status).toBe(404); // quotations aren't made from anything
    expect((await orders("GET", `/new?from=${mine}`, undefined, "viewer")).status).toBe(403);
  });

  test("status: Draft → Finalized → Cancelled; a finalized order can't be edited; challans draw on its pending qty", async () => {
    const so = await json(orders("POST", "", body()));
    expect((await json(orders("POST", `/${so.id}/status`, { status: "finalized" }))).status).toBe("finalized");
    const edit = await orders("PUT", `/${so.id}`, body());
    expect(edit.status).toBe(409);

    const challan = documentInput.parse({ type: "challan", challan_type: "sale", date: "2026-11-12", party_id: ACME, lines: [{ item_id: BOLT, qty: 250, rate: 12_50, gst_rate: 18, from_line_id: so.lines[0].id }] });
    await saveDocument(db, { companyId: co, userId: users.accountant.id, doc: challan });
    expect((await json(orders("GET", `/${so.id}`))).lines[0].pending).toBe(750);

    const back = await orders("POST", `/${so.id}/status`, { status: "draft" });
    expect(back.status).toBe(409);
    expect((await json(back)).error.message).toBe("A finalized sales order can be marked cancelled, not draft.");
    expect((await json(orders("POST", `/${so.id}/status`, { status: "cancelled" }))).status).toBe("cancelled");
    expect((await json(orders("POST", `/${so.id}/status`, { status: "finalized" }))).error.message).toBe("This sales order is cancelled; its status is final.");
    expect((await orders("POST", `/${so.id}/status`, { status: "sent" })).status).toBe(400); // not a sales order status
  });

  test("operators and viewers read but don't write", async () => {
    for (const role of ["operator", "viewer"] as const) {
      expect((await orders("POST", "", body(), role)).status).toBe(403);
      expect((await orders("GET", "?fy=2026", undefined, role)).status).toBe(200);
    }
  });
});
