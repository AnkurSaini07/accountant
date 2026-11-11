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
  await Promise.all(ROLES.map(async (role) => [role, (await upsertUser.run(db, { sub: `fin-${role}`, email: null, name: role, role }))!] as const)),
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

const BOLT = await item("FIN-BOLT");

const line = (extra: Row = {}) => ({ item_id: BOLT, qty: 1000, rate: 12_50, gst_rate: 18, ...extra });
const body = (extra: Row = {}) => ({ date: "2026-11-11", party_id: ACME, lines: [line()], ...extra });
const finalized = async (extra: Row = {}) => {
  const inv = await json(invoices("POST", "", body(extra)));
  return json(invoices("POST", `/${inv.id}/status`, { status: "finalized" }));
};

describe("finalize and cancel invoices", () => {
  test("finalizing locks it: no edits (409), no way back to draft; the number stays", async () => {
    const draft = await json(invoices("POST", "", body()));
    const inv = await json(invoices("POST", `/${draft.id}/status`, { status: "finalized" }));
    expect(inv).toMatchObject({ status: "finalized", number: draft.number, cancel_reason: null });
    const edit = await invoices("PUT", `/${inv.id}`, body({ notes: "changed" }));
    expect(edit.status).toBe(409);
    expect((await json(edit)).error.message).toBe("This document is finalized; only drafts can be edited.");
    expect((await json(invoices("POST", `/${inv.id}/status`, { status: "draft" }))).error.message).toBe("This invoice is finalized; its status is final.");
    expect((await invoices("POST", `/${inv.id}/status`, { status: "finalized" }, "operator")).status).toBe(403);
    expect(await json(invoices("GET", `/${inv.id}`))).toEqual(inv);
  });

  test("cancelling: admins only, with a reason; the number stays used; the invoiced qty goes back to the challan", async () => {
    const so = await json(orders("POST", "", { date: "2026-11-10", party_id: ACME, lines: [line()] }));
    await orders("POST", `/${so.id}/status`, { status: "finalized" });
    const dc = await json(challans("POST", "", { ...(await json(challans("GET", `/new?from=${so.id}`))) }));
    await challans("POST", `/${dc.id}/status`, { status: "finalized" });
    const draft = await json(invoices("POST", "", await json(invoices("GET", `/new?from=${dc.id}`))));
    const inv = await json(invoices("POST", `/${draft.id}/status`, { status: "finalized" }));
    expect((await json(challans("GET", `/${dc.id}`))).lines[0].pending).toBe(0);

    expect((await invoices("POST", `/${inv.id}/cancel`, { reason: "Wrong rate" }, "accountant")).status).toBe(403);
    const blank = await invoices("POST", `/${inv.id}/cancel`, { reason: "  " }, "admin");
    expect(blank.status).toBe(400);
    expect((await json(blank)).error.details.fields).toEqual({ reason: ["Give the reason for cancelling."] });
    expect((await invoices("POST", `/${inv.id}/status`, { status: "cancelled" }, "admin")).status).toBe(409); // not without a reason

    const res = await invoices("POST", `/${inv.id}/cancel`, { reason: "Wrong rate; reissued" }, "admin");
    expect(res.status).toBe(200);
    const cancelled = await json(res);
    expect(cancelled).toMatchObject({ status: "cancelled", number: inv.number, cancel_reason: "Wrong rate; reissued", cancelled_at: expect.any(String) });
    expect((await one<{ by: number }>(db`select cancelled_by as by from documents where id = ${inv.id}`)).by).toBe(users.admin.id);

    // Its goods can be invoiced again; the next invoice takes a new number, never the cancelled one.
    expect((await json(challans("GET", `/${dc.id}`))).lines[0].pending).toBe(1000);
    const again = await json(invoices("POST", "", await json(invoices("GET", `/new?from=${dc.id}`))));
    expect(again.number).not.toBe(inv.number);
    expect(Number(again.number.split("/")[2])).toBe(Number(inv.number.split("/")[2]) + 1);
    expect(await json(invoices("GET", `?fy=2026&status=cancelled`))).toMatchObject({ invoices: [expect.objectContaining({ id: inv.id })] });

    const twice = await invoices("POST", `/${inv.id}/cancel`, { reason: "again" }, "admin");
    expect(twice.status).toBe(409);
    expect((await json(twice)).error.message).toBe("This invoice is cancelled; it can't be cancelled.");
    expect((await json(invoices("POST", `/${inv.id}/status`, { status: "finalized" }))).error.message).toBe("This invoice is cancelled; its status is final.");
  });

  test("a draft can be cancelled too; types without cancelling say so", async () => {
    const draft = await json(invoices("POST", "", body()));
    expect(await json(invoices("POST", `/${draft.id}/cancel`, { reason: "Duplicate entry" }, "admin"))).toMatchObject({ status: "cancelled", cancel_reason: "Duplicate entry" });
    const so = await json(orders("POST", "", { date: "2026-11-10", party_id: ACME, lines: [line()] }));
    expect((await orders("POST", `/${so.id}/cancel`, { reason: "x" }, "admin")).status).toBe(404);
    expect((await invoices("POST", "/999999/cancel", { reason: "x" }, "admin")).status).toBe(404);
  });

  test("a cancelled document's reason is checked by the database too", async () => {
    const inv = await finalized();
    const e = await db`update documents set cancel_reason = 'x' where id = ${inv.id}`.catch((e: unknown) => e);
    expect(String(e)).toMatch(/check constraint/);
  });
});
