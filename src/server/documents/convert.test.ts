import { describe, expect, test } from "bun:test";
import { documentInput } from "../../shared/schemas/document.ts";
import { ValidationError } from "../errors.ts";
import upsertUser from "../auth/upsert_user.sql";
import { testDb } from "../test/db.ts";
import { convertDocument, draftFrom, pendingLines } from "./convert.ts";
import getQuery from "./get.sql";
import { saveDocument } from "./service.ts";

const db = await testDb();
type Row = Record<string, unknown>;
const one = async <T = Row>(sql: Promise<unknown>) => ((await sql) as T[])[0]!;
const { id: co } = await one<{ id: number }>(db`select id from companies order by id limit 1`);
const { id: other } = await one<{ id: number }>(db`insert into companies (legal_name, state_code) values ('Other Firm', '07') returning id`);
const { id: user } = (await upsertUser.run(db, { sub: "doc-convert", email: null, name: "Asha", role: "accountant" }))!;
const party = async (name: string, company = co) =>
  (await one<{ id: number }>(db`insert into parties (company_id, name, kind, registration_type, state_code) values (${company}, ${name}, 'both', 'unregistered', '06') returning id`)).id;
const { id: NOS } = await one<{ id: number }>(db`select id from units where code = 'NOS'`);
const { id: KGS } = await one<{ id: number }>(db`select id from units where code = 'KGS'`);
const { id: G18 } = await one<{ id: number }>(db`select id from gst_rates where rate = 18 limit 1`);
const item = async (code: string, unit: number, company = co) =>
  (await one<{ id: number }>(db`insert into items (company_id, code, name, type, hsn, unit_id, gst_rate_id) values (${company}, ${code}, ${code}, 'finished', '73181500', ${unit}, ${G18}) returning id`)).id;

const ACME = await party("Acme Castings");
const DELTA = await party("Delta Auto");
const BOLT = await item("CV-BOLT", NOS);
const ROD = await item("CV-ROD", KGS);
const FOREIGN_PARTY = await party("Elsewhere Ltd", other);
const FOREIGN_ITEM = await item("CV-X", NOS, other);

type Line = { item_id: number; qty: number; rate?: number; from_line_id?: number };
const doc = (type: string, lines: Line[], party_id = ACME) =>
  documentInput.parse({ type, date: "2026-11-11", party_id, challan_type: type === "challan" ? "sale" : null, lines: lines.map((l) => ({ rate: 100_00, gst_rate: 18, ...l })) });
const save = (type: string, lines: Line[], party_id = ACME, id?: number) => saveDocument(db, { companyId: co, userId: user, id, doc: doc(type, lines, party_id) });
/** An issued source document: saved as a draft, then moved on like its own API would. */
async function issued(type: string, lines: Line[], party_id = ACME, status = type === "quotation" ? "sent" : "finalized") {
  const id = await save(type, lines, party_id);
  await db`update documents set status = ${status} where id = ${id}`;
  return id;
}
const linesOf = async (id: number) => (await getQuery.run(db, { company_id: co, id }))!.lines as { id: number; qty: number; from_line_id: number | null }[];
const pendingOf = async (id: number) => (await pendingLines(db, { companyId: co, documentIds: [id] })).map((l) => l.pending);
const fieldsOf = async (p: Promise<unknown>) => {
  const e = await p.then(() => null, (e: unknown) => e);
  expect(e).toBeInstanceOf(ValidationError);
  return (e as ValidationError).details as { fields: Record<string, string[]> };
};

describe("partial conversion", () => {
  test("an order takes part of a quotation line; the rest stays pending; no more than that can be taken", async () => {
    const q = await issued("quotation", [{ item_id: BOLT, qty: 5000 }, { item_id: ROD, qty: 1_250_500 }]);
    const [bolt, rod] = await linesOf(q);
    expect(await pendingOf(q)).toEqual([5000, 1_250_500]);

    const so = await save("sales_order", [{ item_id: BOLT, qty: 3000, from_line_id: bolt!.id }]);
    expect((await linesOf(so)).map((l) => [l.qty, l.from_line_id])).toEqual([[3000, bolt!.id]]);
    expect(await pendingOf(q)).toEqual([2000, 1_250_500]);

    expect((await fieldsOf(save("sales_order", [{ item_id: BOLT, qty: 2001, from_line_id: bolt!.id }]))).fields).toEqual({
      "lines.0.qty": ["Only 2000 NOS of line 1 of the quotation QTN/26-27/0001 is still pending."],
    });
    // Two lines drawing on one source line count together.
    expect((await fieldsOf(save("sales_order", [{ item_id: BOLT, qty: 1500, from_line_id: bolt!.id }, { item_id: BOLT, qty: 501, from_line_id: bolt!.id }]))).fields).toEqual({
      "lines.1.qty": ["Only 2000 NOS of line 1 of the quotation QTN/26-27/0001 is still pending."],
    });
    await save("sales_order", [{ item_id: BOLT, qty: 2000, from_line_id: bolt!.id }, { item_id: ROD, qty: 250_500, from_line_id: rod!.id }]);
    expect(await pendingOf(q)).toEqual([0, 1_000_000]);
    expect((await fieldsOf(save("sales_order", [{ item_id: ROD, qty: 1_000_001, from_line_id: rod!.id }]))).fields["lines.0.qty"]).toEqual([
      "Only 1000.000 KGS of line 2 of the quotation QTN/26-27/0001 is still pending.",
    ]);
  });

  test("re-saving a converted draft replaces its own links; cancelling it frees the qty", async () => {
    const q = await issued("quotation", [{ item_id: BOLT, qty: 100 }]);
    const [line] = await linesOf(q);
    const so = await save("sales_order", [{ item_id: BOLT, qty: 60, from_line_id: line!.id }]);
    await save("sales_order", [{ item_id: BOLT, qty: 100, from_line_id: line!.id }], ACME, so); // its old 60 don't count against it
    expect(await pendingOf(q)).toEqual([0]);
    expect((await linesOf(so))[0]!.from_line_id).toBe(line!.id);
    await save("sales_order", [{ item_id: BOLT, qty: 40 }], ACME, so); // the link goes with the line
    expect(await pendingOf(q)).toEqual([100]);
    await save("sales_order", [{ item_id: BOLT, qty: 100, from_line_id: line!.id }], ACME, so);
    await db`update documents set status = 'cancelled' where id = ${so}`;
    expect(await pendingOf(q)).toEqual([100]);
  });

  test("two conversions of the same qty at once: one wins, the other is told nothing is left", async () => {
    const q = await issued("quotation", [{ item_id: BOLT, qty: 10 }]);
    const [line] = await linesOf(q);
    const draft = await save("invoice", [{ item_id: BOLT, qty: 1 }]);
    // Different series (or none, re-saving a draft), so nothing but the line lock makes them queue.
    const take = [{ item_id: BOLT, qty: 10, from_line_id: line!.id }];
    const results = await Promise.allSettled([save("sales_order", take), save("invoice", take), save("invoice", take, ACME, draft)]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected", "rejected"]);
    expect(await pendingOf(q)).toEqual([0]);
  });
});

describe("multi-source", () => {
  test("an invoice from two challans of one party: every pending line, each linked to its source", async () => {
    const c1 = await issued("challan", [{ item_id: BOLT, qty: 400 }]);
    const c2 = await issued("challan", [{ item_id: ROD, qty: 2_000 }, { item_id: BOLT, qty: 100 }]);
    const [c1bolt] = await linesOf(c1);
    await save("invoice", [{ item_id: BOLT, qty: 150, from_line_id: c1bolt!.id }]); // part of c1 billed already

    const draft = await draftFrom(db, { companyId: co, type: "invoice", sourceIds: [c1, c2] });
    expect(draft).toMatchObject({ type: "invoice", party_id: ACME, challan_type: null });
    expect(draft.lines.map((l) => [l.item_id, l.qty])).toEqual([[BOLT, 250], [ROD, 2_000], [BOLT, 100]]);

    const inv = await convertDocument(db, { companyId: co, userId: user, type: "invoice", sourceIds: [c1, c2], changes: { party_ref: "PO-881" } });
    const lines = await linesOf(inv);
    const sources = [...(await linesOf(c1)), ...(await linesOf(c2))].map((l) => l.id);
    expect(lines.map((l) => l.from_line_id)).toEqual(sources);
    expect(await pendingOf(c1)).toEqual([0]);
    expect(await pendingOf(c2)).toEqual([0, 0]);
    expect((await getQuery.run(db, { company_id: co, id: inv }))!.party_ref).toBe("PO-881");
    expect((await fieldsOf(draftFrom(db, { companyId: co, type: "invoice", sourceIds: [c1, c2] }))).fields).toEqual({ source_ids: ["Everything on them has been converted already."] });
  });

  test("sources must be for one party and exist in this company; a challan draft starts as a sale challan", async () => {
    const a = await issued("sales_order", [{ item_id: BOLT, qty: 5 }]);
    const d = await issued("sales_order", [{ item_id: BOLT, qty: 5 }], DELTA);
    expect((await fieldsOf(draftFrom(db, { companyId: co, type: "challan", sourceIds: [a, d] }))).fields).toEqual({ source_ids: ["Choose documents for one party."] });
    expect((await fieldsOf(draftFrom(db, { companyId: co, type: "challan", sourceIds: [a, 999_999] }))).fields).toEqual({ source_ids: ["Choose documents from the list."] });
    expect((await fieldsOf(draftFrom(db, { companyId: other, type: "challan", sourceIds: [a] }))).fields).toEqual({ source_ids: ["Choose documents from the list."] });
    expect(await draftFrom(db, { companyId: co, type: "challan", sourceIds: [a] })).toMatchObject({ challan_type: "sale", party_id: ACME });
  });
});

describe("what can't be converted", () => {
  test("wrong source type, unissued or dead source, another party, another item, another company's line", async () => {
    const po = await issued("purchase_order", [{ item_id: BOLT, qty: 5 }]);
    const draftQ = await save("quotation", [{ item_id: BOLT, qty: 5 }]);
    const rejected = await issued("quotation", [{ item_id: BOLT, qty: 5 }], ACME, "rejected");
    const delta = await issued("quotation", [{ item_id: BOLT, qty: 5 }], DELTA);
    const foreign = await saveDocument(db, { companyId: other, userId: user, doc: doc("quotation", [{ item_id: FOREIGN_ITEM, qty: 5 }], FOREIGN_PARTY) });
    const ids = async (id: number) => (await db`select id from document_lines where document_id = ${id}` as { id: number }[])[0]!.id;

    const err = await fieldsOf(
      save("sales_order", [
        { item_id: BOLT, qty: 1, from_line_id: await ids(po) },
        { item_id: BOLT, qty: 1, from_line_id: await ids(draftQ) },
        { item_id: BOLT, qty: 1, from_line_id: await ids(rejected) },
        { item_id: BOLT, qty: 1, from_line_id: await ids(delta) },
        { item_id: ROD, qty: 1, from_line_id: await ids(delta) },
        { item_id: BOLT, qty: 1, from_line_id: await ids(foreign) },
      ]),
    );
    const qNumber = async (id: number) => (await getQuery.run(db, { company_id: co, id }))!.number;
    expect(err.fields).toEqual({
      "lines.0.from_line_id": ["A sales order can't be made from a purchase order."],
      "lines.1.from_line_id": [`The quotation ${await qNumber(draftQ)} is draft, so it can't be converted.`],
      "lines.2.from_line_id": [`The quotation ${await qNumber(rejected)} is rejected, so it can't be converted.`],
      "lines.3.from_line_id": [`The quotation ${await qNumber(delta)} is for another party.`],
      "lines.4.from_line_id": [`The quotation ${await qNumber(delta)} is for another party.`],
      "lines.5.from_line_id": ["That source line isn't on any of this company's documents."],
    });
    const sameParty = await issued("quotation", [{ item_id: BOLT, qty: 5 }]);
    expect((await fieldsOf(save("sales_order", [{ item_id: ROD, qty: 1, from_line_id: await ids(sameParty) }]))).fields).toEqual({
      "lines.0.item_id": ["Line 1 of the quotation " + (await qNumber(sameParty)) + " is CV-BOLT; keep that item."],
    });
    expect(await pendingOf(sameParty)).toEqual([5]); // nothing was linked by the failed saves
  });
});
