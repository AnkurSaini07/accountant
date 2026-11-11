import { describe, expect, test } from "bun:test";
import { documentInput } from "../../shared/schemas/document.ts";
import { ConflictError, NotFoundError, ValidationError } from "../errors.ts";
import upsertUser from "../auth/upsert_user.sql";
import { testDb } from "../test/db.ts";
import getQuery from "./get.sql";
import { saveDocument } from "./service.ts";

const db = await testDb();
type Row = Record<string, unknown>;
const one = async <T = Row>(sql: Promise<unknown>) => ((await sql) as T[])[0]!;
const { id: co } = await one<{ id: number }>(db`select id from companies order by id limit 1`); // Haryana (06)
const { id: other } = await one<{ id: number }>(db`insert into companies (legal_name, state_code) values ('Other Firm', '07') returning id`);
const { id: user } = (await upsertUser.run(db, { sub: "doc-svc", email: null, name: "Asha", role: "accountant" }))!;

const party = async (name: string, state: string, kind = "customer", company = co) =>
  (await one<{ id: number }>(db`insert into parties (company_id, name, kind, registration_type, state_code) values (${company}, ${name}, ${kind}, 'unregistered', ${state}) returning id`)).id;
const { id: NOS } = await one<{ id: number }>(db`select id from units where code = 'NOS'`);
const { id: KGS } = await one<{ id: number }>(db`select id from units where code = 'KGS'`);
const { id: G18 } = await one<{ id: number }>(db`select id from gst_rates where rate = 18 limit 1`);
const item = async (code: string, unit: number, hsn: string | null, company = co) =>
  (await one<{ id: number }>(db`insert into items (company_id, code, name, type, hsn, unit_id, gst_rate_id) values (${company}, ${code}, ${code}, 'finished', ${hsn}, ${unit}, ${G18}) returning id`)).id;

const LOCAL = await party("Sharma Traders", "06");
const DELHI = await party("Delhi Steels", "07", "supplier");
const BOLT = await item("BOLT", NOS, "73181500");
const ROD = await item("ROD", KGS, "72142090");

/** What a form would send, through the shared schema (so unknown keys like amounts are dropped). */
const input = (extra: Row = {}) =>
  documentInput.parse({
    type: "invoice", date: "2026-11-11", party_id: LOCAL,
    lines: [
      { item_id: BOLT, qty: 5000, rate: 12_50, gst_rate: 18 }, // ₹62,500 → ₹5,625 + ₹5,625
      { item_id: ROD, qty: 1_250_500, rate: 62_40, discount_bp: 250, gst_rate: 18, description: "Bright bar" }, // ₹76,080.42 → ₹6,847.24 each
    ],
    ...extra,
  });
const save = (doc = input(), id?: number) => saveDocument(db, { companyId: co, userId: user, id, doc });
const get = async (id: number) => (await getQuery.run(db, { company_id: co, id }))!;
const fieldsOf = async (p: Promise<unknown>) => {
  const e = await p.then(() => null, (e: unknown) => e);
  expect(e).toBeInstanceOf(ValidationError);
  return (e as ValidationError).details as { fields: Record<string, string[]> };
};

describe("create", () => {
  test("a new invoice: numbered from the series, lines copied, amounts worked out on the server", async () => {
    const id = await save(input({ grand_total: 1, taxable_total: 1, lines: [{ item_id: BOLT, qty: 10, rate: 100_00, gst_rate: 18, taxable: 5 }] }));
    const d = await get(id);
    expect(d).toMatchObject({ number: "INV/26-27/0001", fy: 2026, status: "draft", party_name: "Sharma Traders", place_of_supply: "06", created_by: user });
    // 10 × ₹100 = ₹1,000; 9% + 9%; the ₹1 / 5 paise the "client" sent are ignored.
    expect(d).toMatchObject({ taxable_total: 1_000_00, cgst_total: 90_00, sgst_total: 90_00, igst_total: 0, round_off: 0, grand_total: 1_180_00 });
    expect(d.lines).toMatchObject([{ position: 1, item_name: "BOLT", hsn: "73181500", unit: "NOS", qty: 10, taxable: 1_000_00, cgst: 90_00, sgst: 90_00, igst: 0 }]);
  });

  test("numbers run on; lines keep their order and amounts", async () => {
    const d = await get(await save());
    expect(d.number).toBe("INV/26-27/0002");
    expect(d.lines.map((l: Row) => [l.position, l.item_name, l.description, l.taxable, l.cgst])).toEqual([
      [1, "BOLT", "", 62_500_00, 5_625_00],
      [2, "ROD", "Bright bar", 76_080_42, 6_847_24],
    ]);
    expect(d).toMatchObject({ taxable_total: 1_38_580_42, cgst_total: 12_472_24, round_off: 10, grand_total: 1_63_525_00 });
  });

  test("ship-to in another state: IGST; a Delhi supplier's bill: IGST, place of supply ours", async () => {
    const shipped = await get(await save(input({ shipping_address: { label: "Site", address: "", city: "Noida", pincode: null, state_code: "09" } })));
    expect(shipped).toMatchObject({ place_of_supply: "09", cgst_total: 0, igst_total: 24_944_48 });
    const bill = await get(await save(input({ type: "purchase_bill", party_id: DELHI, party_ref: "DS/1182", party_ref_date: "2026-11-05" })));
    expect(bill).toMatchObject({ number: "PB/26-27/0001", place_of_supply: "06", party_ref: "DS/1182", cgst_total: 0, igst_total: 24_944_48 });
  });

  test("a failed save takes nothing: no document, no number used", async () => {
    const before = (await one<{ n: number }>(db`select count(*)::int as n from documents`)).n;
    const series = () => one<{ next: number }>(db`select next_number as next from number_series where company_id = ${co} and doc_type = 'invoice' and fy = 2026`);
    const { next } = await series();
    const theirs = await item("THEIRS", NOS, "7318", other);
    const unknown = await fieldsOf(save(input({ lines: [{ item_id: BOLT, qty: 1, rate: 1, gst_rate: 18 }, { item_id: theirs, qty: 1, rate: 1, gst_rate: 18 }] })));
    expect(unknown.fields).toEqual({ "lines.1.item_id": ["Choose an item from the list."] });
    const noHsn = await fieldsOf(save(input({ lines: [{ item_id: await item("NOHSN", NOS, null), qty: 1, rate: 1, gst_rate: 18 }] })));
    expect(noHsn.fields["lines.0.item_id"]![0]).toMatch(/HSN\/SAC must be 4, 6 or 8 digits.*Add it to the item first/);
    const otherParty = await fieldsOf(save(input({ party_id: await party("Elsewhere", "07", "customer", other) })));
    expect(otherParty.fields).toEqual({ party_id: ["Choose a party from the list."] });
    expect((await one<{ n: number }>(db`select count(*)::int as n from documents`)).n).toBe(before);
    expect(await series()).toEqual({ next }); // each failed save gave its number back
    expect((await get(await save())).number).toBe(`INV/26-27/${String(next).padStart(4, "0")}`);
  });

  test("the schema: a challan needs its type; e-way bill is 12 digits; at least one line", () => {
    const issues = (raw: Row) => documentInput.safeParse({ date: "2026-11-11", party_id: 1, lines: [{ item_id: 1, qty: 1, rate: 0, gst_rate: 18 }], ...raw }).error?.issues.map((i) => i.path.join("."));
    expect(issues({ type: "challan" })).toEqual(["challan_type"]);
    expect(issues({ type: "invoice", challan_type: "sale" })).toEqual(["challan_type"]);
    expect(issues({ type: "challan", challan_type: "job_work", eway_bill_no: "3310 0012 3456" })).toBeUndefined();
    expect(issues({ type: "invoice", eway_bill_no: "1234" })).toEqual(["eway_bill_no"]);
    expect(issues({ type: "invoice", lines: [] })).toEqual(["lines"]);
    expect(issues({ type: "invoice", lines: [{ item_id: 1, qty: 0, rate: -1, gst_rate: 18.555 }] })).toEqual(["lines.0.qty", "lines.0.rate", "lines.0.gst_rate"]);
  });
});

describe("update", () => {
  test("updating a draft replaces its lines and recomputes; the number stays", async () => {
    const id = await save();
    const { number, lines: old } = await get(id);
    await save(input({ notes: "Deliver to gate 2", lines: [{ item_id: ROD, qty: 1000, rate: 50_00, gst_rate: 18 }] }), id);
    const d = await get(id);
    expect(d).toMatchObject({ number, notes: "Deliver to gate 2", taxable_total: 50_00, cgst_total: 4_50, grand_total: 59_00 });
    expect(d.lines.map((l: Row) => [l.position, l.item_name, l.qty])).toEqual([[1, "ROD", 1000]]);
    expect((await one<{ n: number }>(db`select count(*)::int as n from document_lines where id = any(${old.map((l: Row) => l.id)}::int[])`)).n).toBe(0);
  });

  test("documents that aren't drafts can't be updated", async () => {
    const id = await save();
    await db`update documents set status = 'finalized' where id = ${id}`;
    const before = await get(id);
    const e = await save(input({ notes: "changed" }), id).catch((e: unknown) => e);
    expect(e).toBeInstanceOf(ConflictError);
    expect((e as Error).message).toBe("This document is finalized; only drafts can be edited.");
    expect(await get(id)).toEqual(before);
  });

  test("type and financial year are fixed; unknown ids are 404", async () => {
    const id = await save();
    expect((await fieldsOf(save(input({ type: "quotation" }), id))).fields).toEqual({ type: ["A document can't change type."] });
    expect((await fieldsOf(save(input({ date: "2027-04-01" }), id))).fields).toEqual({ date: ["Keep the date in FY 2026-27; its number is from that year."] });
    await save(input({ date: "2027-03-31" }), id); // same FY: fine
    expect(await save(input(), 999_999).catch((e: unknown) => e)).toBeInstanceOf(NotFoundError);
  });
});
