import { describe, expect, test } from "bun:test";
import { createApp } from "../app.ts";
import type { Oidc, Role } from "../auth/oidc.ts";
import { ROLES } from "../auth/oidc.ts";
import { createSession } from "../auth/sessions.ts";
import upsertUser from "../auth/upsert_user.sql";
import setStatus from "../documents/set_status.sql";
import { testDb } from "../test/db.ts";

const db = await testDb();
const app = createApp({ db, oidc: {} as Oidc });
const cookies = Object.fromEntries(
  await Promise.all(
    ROLES.map(async (role) => {
      const user = (await upsertUser.run(db, { sub: `qtn-${role}`, email: null, name: role, role }))!;
      return [role, `session=${(await createSession(db, user.id)).token}`] as const;
    }),
  ),
) as Record<Role, string>;
const call = (method: string, path: string, body?: unknown, role: Role = "accountant") =>
  app.request(`/api/quotations${path}`, {
    method,
    headers: { cookie: cookies[role], ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON for assertions
const json = async (res: Response) => (await res.json()) as any;

type Row = Record<string, unknown>;
const one = async <T = Row>(sql: Promise<unknown>) => ((await sql) as T[])[0]!;
const { id: co } = await one<{ id: number }>(db`select id from companies order by id limit 1`);
const party = async (name: string) => (await one<{ id: number }>(db`insert into parties (company_id, name, kind, registration_type, state_code) values (${co}, ${name}, 'customer', 'unregistered', '06') returning id`)).id;
const { id: NOS } = await one<{ id: number }>(db`select id from units where code = 'NOS'`);
const { id: G18 } = await one<{ id: number }>(db`select id from gst_rates where rate = 18 limit 1`);
const { id: BOLT } = await one<{ id: number }>(db`insert into items (company_id, code, name, type, hsn, unit_id, gst_rate_id) values (${co}, 'BOLT', 'Hex Bolt M10', 'finished', '73181500', ${NOS}, ${G18}) returning id`);
const SHARMA = await party("Sharma Traders");
const GUPTA = await party("Gupta Engg");

const quote = (extra: Row = {}) => ({
  date: "2026-11-11", party_id: SHARMA, due_date: "2026-11-25", terms: "Prices ex-works Faridabad.",
  lines: [{ item_id: BOLT, qty: 1000, rate: 12_50, gst_rate: 18 }], // ₹12,500 + ₹1,125 + ₹1,125 = ₹14,750
  ...extra,
});
const create = async (extra: Row = {}) => json(await call("POST", "", quote(extra)));
const move = (id: number, status: string, role: Role = "accountant") => call("POST", `/${id}/status`, { status }, role);

describe("create, read, update", () => {
  test("POST creates a numbered draft quotation with server totals; anyone reads it", async () => {
    const res = await call("POST", "", quote({ grand_total: 1 }));
    expect(res.status).toBe(201);
    const q = await json(res);
    expect(q).toMatchObject({ type: "quotation", number: "QTN/26-27/0001", status: "draft", party_name: "Sharma Traders", due_date: "2026-11-25", grand_total: 14_750_00 });
    expect(await json(await call("GET", `/${q.id}`, undefined, "viewer"))).toEqual(q);
  });

  test("challan fields aren't part of a quotation; bad input is a 400 with fields", async () => {
    const q = await create({ challan_type: "sale", vehicle_no: "HR51AB1234" });
    expect(q).toMatchObject({ challan_type: null, vehicle_no: null });
    const res = await call("POST", "", quote({ party_id: 0, lines: [] }));
    expect(res.status).toBe(400);
    expect(Object.keys((await json(res)).error.details.fields).sort()).toEqual(["lines", "party_id"]);
  });

  test("PUT replaces a draft; another document's id is 404", async () => {
    const { id } = await create();
    const res = await call("PUT", `/${id}`, quote({ lines: [{ item_id: BOLT, qty: 2000, rate: 12_00, gst_rate: 18 }] }));
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ number: "QTN/26-27/0003", grand_total: 28_320_00, lines: [{ qty: 2000, rate: 12_00 }] });
    const [{ id: invoice }] = await db`insert into documents (company_id, type, fy, date, party_id) values (${co}, 'invoice', 2026, '2026-11-11', ${SHARMA}) returning id`;
    expect((await call("GET", `/${invoice}`)).status).toBe(404);
    expect((await call("PUT", `/${invoice}`, quote())).status).toBe(404);
    expect((await call("GET", "/999999")).status).toBe(404);
  });
});

describe("status", () => {
  test("Draft → Sent → Accepted; a sent quotation can't be edited", async () => {
    const { id } = await create();
    expect(await json(await move(id, "sent"))).toMatchObject({ status: "sent" });
    const edit = await call("PUT", `/${id}`, quote());
    expect(edit.status).toBe(409);
    expect((await json(edit)).error.message).toBe("This document is sent; only drafts can be edited.");
    expect(await json(await move(id, "accepted"))).toMatchObject({ status: "accepted" });
  });

  test("only the moves FR-4.1 lists", async () => {
    const { id } = await create();
    const skip = await move(id, "accepted"); // a draft hasn't been sent
    expect(skip.status).toBe(409);
    expect((await json(skip)).error.message).toBe("A draft quotation can be marked sent, not accepted.");
    await move(id, "sent");
    for (const end of ["rejected", "expired"]) {
      const { id: other } = await create();
      await move(other, "sent");
      expect(await json(await move(other, end))).toMatchObject({ status: end });
    }
    await move(id, "rejected");
    const final = await move(id, "accepted");
    expect(final.status).toBe(409);
    expect((await json(final)).error.message).toBe("This quotation is rejected; its status is final.");
    expect((await call("POST", `/${id}/status`, { status: "finalized" })).status).toBe(400); // not a quotation status
  });
  test("a move only applies from the status it was checked against (two clicks can't both win)", async () => {
    const { id } = await create();
    await move(id, "sent");
    // The second click read "draft" before the first one committed:
    expect(await setStatus.run(db, { company_id: co, id, type: "quotation", from: "draft", status: "sent" })).toBeNull();
    expect(await setStatus.run(db, { company_id: co, id, type: "invoice", from: "sent", status: "accepted" })).toBeNull(); // and only its own type
  });
});

describe("list", () => {
  test("filter by status, party and date range, with search and paging", async () => {
    const fy = "fy=2026";
    const a = await create({ party_id: GUPTA, date: "2026-06-10" });
    const b = await create({ party_id: GUPTA, date: "2026-08-20" });
    await move(b.id, "sent");
    const ids = async (qs: string) => (await json(await call("GET", `?${fy}&${qs}`, undefined, "viewer"))).quotations.map((r: Row) => r.id);
    expect(await ids(`party_id=${GUPTA}`)).toEqual([b.id, a.id]);
    expect(await ids(`party_id=${GUPTA}&status=sent`)).toEqual([b.id]);
    expect(await ids(`party_id=${GUPTA}&from=2026-07-01`)).toEqual([b.id]);
    expect(await ids(`party_id=${GUPTA}&to=2026-07-01`)).toEqual([a.id]);
    expect(await ids(`party_id=${GUPTA}&from=2026-06-10&to=2026-06-10`)).toEqual([a.id]);
    expect(await ids(`q=gupta`)).toEqual([b.id, a.id]);
    expect(await ids(`q=${encodeURIComponent(b.number)}`)).toEqual([b.id]);
    const all = await json(await call("GET", `?${fy}`));
    const page = await json(await call("GET", `?${fy}&page=2&page_size=2`));
    expect(page).toMatchObject({ total: all.total, page: 2, page_size: 2 });
    expect(page.quotations.map((r: Row) => r.id)).toEqual(all.quotations.slice(2, 4).map((r: Row) => r.id));
    expect((await call("GET", "?fy=2026&from=2026-09-01&to=2026-08-01")).status).toBe(400);
    expect((await call("GET", "")).status).toBe(400); // fy is required
  });
});

describe("roles", () => {
  test("operators and viewers read but can't create, edit or move quotations", async () => {
    const { id } = await create();
    for (const role of ["operator", "viewer"] as const) {
      expect((await call("GET", `/${id}`, undefined, role)).status).toBe(200);
      expect((await call("POST", "", quote(), role)).status).toBe(403);
      expect((await call("PUT", `/${id}`, quote(), role)).status).toBe(403);
      expect((await move(id, "sent", role)).status).toBe(403);
    }
    expect((await move(id, "sent", "admin")).status).toBe(200);
  });
});
