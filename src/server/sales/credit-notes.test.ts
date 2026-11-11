import { describe, expect, test } from "bun:test";
import { documentInput } from "../../shared/schemas/document.ts";
import { createApp } from "../app.ts";
import type { Oidc, Role } from "../auth/oidc.ts";
import { ROLES } from "../auth/oidc.ts";
import { createSession } from "../auth/sessions.ts";
import upsertUser from "../auth/upsert_user.sql";
import { testDb } from "../test/db.ts";

const db = await testDb();
const app = createApp({ db, oidc: {} as Oidc });
const users = Object.fromEntries(
  await Promise.all(ROLES.map(async (role) => [role, (await upsertUser.run(db, { sub: `cn-${role}`, email: null, name: role, role }))!] as const)),
) as unknown as Record<Role, { id: number }>;
const cookies = Object.fromEntries(await Promise.all(ROLES.map(async (role) => [role, `session=${(await createSession(db, users[role].id)).token}`] as const))) as Record<Role, string>;
const request = (base: string) => (method: string, path: string, body?: unknown, role: Role = "accountant") =>
  app.request(`/api/${base}${path}`, {
    method,
    headers: { cookie: cookies[role], ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const invoices = request("invoices");
const notes = request("credit-notes");
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

const BOLT = await item("CN-BOLT");

const line = (extra: Row = {}) => ({ item_id: BOLT, qty: 1000, rate: 12_50, gst_rate: 18, ...extra });
const body = (extra: Row = {}) => ({ date: "2026-11-11", party_id: ACME, lines: [line()], ...extra });
const DELHI = await party("Delta Auto", "07");
const NUT = await item("CN-NUT");
/** A finalized invoice: 1000 bolts at ₹12.50 (₹12,500 taxable) and 500 nuts at ₹4.00 (₹2,000). */
const invoice = async (extra: Row = {}) => {
  const inv = await json(invoices("POST", "", body({ lines: [line(), line({ item_id: NUT, qty: 500, rate: 4_00 })], ...extra })));
  return json(invoices("POST", `/${inv.id}/status`, { status: "finalized" }));
};
const draftFor = async (inv: { id: number }) => json(notes("GET", `/new?from=${inv.id}`));
const save = async (draft: Row, extra: Row = {}) => notes("POST", "", { ...draft, ...extra });
const err = async (res: Response | Promise<Response>) => (await json(res)).error;

describe("credit notes", () => {
  test("from a finalized invoice: its lines, its place of supply, its number quoted; a return; finalize", async () => {
    const inv = await invoice({ party_id: DELHI });
    expect(inv.igst_total).toBeGreaterThan(0);
    const draft = await draftFor(inv);
    expect(draft).toMatchObject({ type: "credit_note", note_reason: "return", party_id: DELHI, place_of_supply: "07", party_ref: inv.number, party_ref_date: "2026-11-11" });
    expect(draft.lines.map((l: Row) => [l.item_id, l.qty, l.rate, l.from_line_id])).toEqual([[BOLT, 1000, 12_50, inv.lines[0].id], [NUT, 500, 4_00, inv.lines[1].id]]);

    const res = await save(draft, { lines: [{ ...draft.lines[0], qty: 200 }] }); // 200 bolts came back
    expect(res.status).toBe(201);
    const cn = await json(res);
    expect(cn).toMatchObject({ type: "credit_note", status: "draft", note_reason: "return", taxable_total: 2_500_00, igst_total: 450_00, grand_total: 2_950_00 });
    expect((await json(invoices("GET", `/${inv.id}`))).lines.map((l: Row) => l.pending)).toEqual([800, 500]);
    const done = await json(notes("POST", `/${cn.id}/status`, { status: "finalized" }));
    expect(done.number).toMatch(/^CN\//);
    expect((await notes("PUT", `/${cn.id}`, { ...draft, lines: [{ ...draft.lines[0], qty: 100 }] })).status).toBe(409);
  });

  test("a return can't take more than is left on the invoice, across notes", async () => {
    const inv = await invoice();
    const draft = await draftFor(inv);
    await save(draft, { lines: [{ ...draft.lines[0], qty: 700 }] });
    const over = await save(draft, { lines: [{ ...draft.lines[0], qty: 400 }] });
    expect(over.status).toBe(400);
    expect((await err(over)).details.fields).toEqual({ "lines.0.qty": [`Only 300 NOS of line 1 of the invoice ${inv.number} is still pending.`] });
    expect((await save(draft, { lines: [{ ...draft.lines[0], qty: 300 }] })).status).toBe(201);
    expect((await draftFor(inv)).lines.map((l: Row) => l.qty)).toEqual([500]); // only the nuts are left to return
  });

  test("a rate difference credits value, not qty; never more than the invoiced value", async () => {
    const inv = await invoice();
    const draft = await draftFor(inv);
    const rate = (extra: Row) => save(draft, { note_reason: "rate_difference", lines: [{ ...draft.lines[0], ...extra }] });
    // ₹2.50 less on all 1000 bolts: ₹2,500 of the ₹12,500.
    expect((await rate({ rate: 2_50 })).status).toBe(201);
    expect((await json(invoices("GET", `/${inv.id}`))).lines[0].pending).toBe(1000); // the goods stay sold
    const tooMany = await rate({ qty: 1001, rate: 1_00 });
    expect((await err(tooMany)).details.fields).toEqual({ "lines.0.qty": [`Line 1 of the invoice ${inv.number} is for 1000 NOS.`] });
    const tooMuch = await rate({ rate: 10_01 }); // ₹10,010 > the ₹10,000 left
    expect((await err(tooMuch)).details.fields).toEqual({ "lines.0.rate": [`Only ₹10,000.00 of line 1 of the invoice ${inv.number} (taxable value) is left to credit.`] });
    // A return after it: the qty is all there, but only the value left can be credited.
    expect((await save(draft, { lines: [{ ...draft.lines[0], qty: 1000 }] })).status).toBe(400);
    expect((await save(draft, { lines: [{ ...draft.lines[0], qty: 800 }] })).status).toBe(201); // ₹10,000 exactly
  });

  test("one invoice per note; every line from it; a reason; only finalized invoices", async () => {
    const a = await invoice();
    const b = await invoice();
    const [la, lb] = [(await draftFor(a)).lines[0], (await draftFor(b)).lines[0]];
    const both = await save(await draftFor(a), { lines: [la, lb] });
    expect((await err(both)).message).toBe("A credit note is against one invoice.");
    const loose = await save(await draftFor(a), { lines: [la, line()] });
    expect((await err(loose)).details.fields).toEqual({ "lines.1.from_line_id": ["Take this line from the invoice."] });
    const noReason = await save(await draftFor(a), { note_reason: null });
    expect((await err(noReason)).details.fields).toEqual({ note_reason: ["Choose why: goods returned or a rate difference."] });
    const draftInv = await json(invoices("POST", "", body()));
    expect((await err(notes("GET", `/new?from=${draftInv.id}`))).message).toBe(`The invoice ${draftInv.number} is draft, so it can't be converted.`);
    const ignored = await json(invoices("POST", "", { ...body(), note_reason: "return" })); // invoices drop it
    expect(ignored.note_reason).toBeNull();
  });

  test("an invoice with a credit note can't be cancelled until the note is; cancelling the note gives its credit back", async () => {
    const inv = await invoice();
    const cn = await json(await save(await draftFor(inv)));
    await notes("POST", `/${cn.id}/status`, { status: "finalized" });
    const number = (await json(notes("GET", `/${cn.id}`))).number;
    const blocked = await invoices("POST", `/${inv.id}/cancel`, { reason: "Wrong rate" }, "admin");
    expect(blocked.status).toBe(409);
    expect((await err(blocked)).message).toBe(`Cancel credit note ${number} first; it is against this invoice.`);
    expect((await notes("POST", `/${cn.id}/cancel`, { reason: "Goods not returned after all" }, "admin")).status).toBe(200);
    expect((await json(invoices("GET", `/${inv.id}`))).lines.map((l: Row) => l.pending)).toEqual([1000, 500]);
    const again = await json(await save(await draftFor(inv))); // all of it can be credited again
    expect((await invoices("POST", `/${inv.id}/cancel`, { reason: "Wrong rate" }, "admin")).status).toBe(409); // that new draft stands
    await notes("POST", `/${again.id}/cancel`, { reason: "Raised by mistake" }, "admin");
    expect(await json(invoices("POST", `/${inv.id}/cancel`, { reason: "Wrong rate" }, "admin"))).toMatchObject({ status: "cancelled" }); // only cancelled notes left
  });

  test("the shared schema: notes need a reason, other documents can't have one", () => {
    const d = { date: "2026-11-11", party_id: ACME, lines: [line()] };
    expect(documentInput.safeParse({ ...d, type: "credit_note" }).error?.issues.map((i) => i.message)).toEqual(["Choose why: goods returned or a rate difference."]);
    expect(documentInput.safeParse({ ...d, type: "invoice", note_reason: "return" }).error?.issues.map((i) => i.message)).toEqual(["Only credit and debit notes have a reason."]);
    expect(documentInput.safeParse({ ...d, type: "debit_note", note_reason: "rate_difference" }).success).toBe(true);
  });

  test("roles: viewers can't write; the database insists only notes have a reason", async () => {
    const inv = await invoice();
    expect((await notes("POST", "", await draftFor(inv), "viewer")).status).toBe(403);
    const e = await db`update documents set note_reason = 'return' where id = ${inv.id}`.catch((e: unknown) => e);
    expect(String(e)).toMatch(/check constraint/);
  });
});
