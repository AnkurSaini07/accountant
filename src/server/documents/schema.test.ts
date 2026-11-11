import { describe, expect, test } from "bun:test";
import { testDb } from "../test/db.ts";
import getQuery from "./get.sql";
import listQuery from "./list.sql";

const db = await testDb();
type Row = Record<string, unknown>;
const one = async <T = Row>(sql: Promise<unknown>) => ((await sql) as T[])[0]!;
const { id: co } = await one<{ id: number }>(db`select id from companies order by id limit 1`);
const { id: other } = await one<{ id: number }>(db`insert into companies (legal_name, state_code) values ('Other Firm', '07') returning id`);

const newParty = async (name: string, company = co) => {
  const { id } = await one<{ id: number }>(db`insert into parties (company_id, name, kind, registration_type, state_code) values (${company}, ${name}, 'customer', 'unregistered', '07') returning id`);
  await db`insert into party_addresses (party_id, kind, address, city, pincode, state_code) values (${id}, 'billing', '12 Okhla Phase II', 'New Delhi', '110020', '07')`;
  return id;
};
const PARTY = await newParty("Sharma Traders");
const { id: NOS } = await one<{ id: number }>(db`select id from units where code = 'NOS'`);
const { id: G18 } = await one<{ id: number }>(db`select id from gst_rates where rate = 18 limit 1`);
const { id: ITEM } = await one<{ id: number }>(
  db`insert into items (company_id, code, name, type, hsn, unit_id, gst_rate_id) values (${co}, 'FG-1', 'Hex Bolt M10', 'finished', '73181500', ${NOS}, ${G18}) returning id`,
);

const doc = (extra: Row = {}) => {
  const d = { company_id: co, type: "invoice", fy: 2026, date: "2026-11-11", party_id: PARTY, ...extra };
  return one<{ id: number }>(db`insert into documents ${db(d)} returning id`);
};
const get = (id: number) => getQuery.run(db, { company_id: co, id });

describe("documents", () => {
  test("party, GSTIN, state and billing address are copied onto the document; place of supply follows", async () => {
    const { id } = await doc();
    expect(await get(id)).toMatchObject({
      party_name: "Sharma Traders", party_gstin: null, party_state_code: "07", place_of_supply: "07", status: "draft", number: null,
      billing_address: { label: null, address: "12 Okhla Phase II", city: "New Delhi", pincode: "110020", state_code: "07" },
      lines: [],
    });
    const shipped = await doc({ shipping_address: { label: "Plant 2", address: "", city: "Faridabad", pincode: null, state_code: "06" } });
    expect((await get(shipped.id))!.place_of_supply).toBe("06"); // goods are supplied where they're delivered
    // Purchases come to us: our state (the company's is 06), not the Delhi supplier's (0012).
    for (const type of ["purchase_order", "grn", "purchase_bill", "debit_note"]) expect((await get((await doc({ type })).id))!.place_of_supply).toBe("06");
  });

  test("a draft follows the party; once issued it keeps the party as it was", async () => {
    const party = await newParty("Gupta Engg");
    const { id } = await doc({ party_id: party });
    await db`update parties set name = 'Gupta Engineering' where id = ${party}`;
    await db`update documents set notes = 'call first' where id = ${id}`; // a draft save picks up the new name
    expect((await get(id))!.party_name).toBe("Gupta Engineering");
    await db`update documents set status = 'finalized', number = 'INV/26-27/0001' where id = ${id}`;
    await db`update parties set name = 'Gupta Engineering Works' where id = ${party}`;
    await db`update party_addresses set city = 'Gurugram' where party_id = ${party}`;
    await db`update documents set notes = 'paid' where id = ${id}`;
    expect(await get(id)).toMatchObject({ party_name: "Gupta Engineering", billing_address: { city: "New Delhi" } });
  });

  test("numbers are unique per company, type and FY; at most 16 characters; drafts may have none", async () => {
    await doc({ number: "INV/26-27/0100", status: "finalized" });
    await expect(doc({ number: "INV/26-27/0100", status: "finalized" })).rejects.toThrow(/documents_company_id_type_fy_number_key/);
    await doc({ number: "INV/26-27/0100", status: "finalized", type: "credit_note" }); // another type
    await doc({ number: "INV/26-27/0100", status: "finalized", fy: 2027, date: "2027-04-01" }); // another FY
    await expect(doc({ number: "INV/2026-27/00001", status: "finalized" })).rejects.toThrow(/number_check/);
    await expect(doc({ status: "finalized" })).rejects.toThrow(/check/);
    await doc(); // two drafts without numbers are fine
    await doc();
  });

  test("the FY must be the one the date falls in (1 April – 31 March)", async () => {
    await doc({ date: "2027-03-31", fy: 2026 });
    await expect(doc({ date: "2027-04-01", fy: 2026 })).rejects.toThrow(/check/);
    await expect(doc({ date: "2026-03-31", fy: 2026 })).rejects.toThrow(/check/);
  });

  test("challan type on challans only; e-way bill numbers are 12 digits", async () => {
    await doc({ type: "challan", challan_type: "job_work", eway_bill_no: "331000123456" });
    await expect(doc({ type: "challan" })).rejects.toThrow(/check/);
    await expect(doc({ challan_type: "sale" })).rejects.toThrow(/check/);
    await expect(doc({ type: "challan", challan_type: "sale", eway_bill_no: "1234" })).rejects.toThrow(/eway_bill_no_check/);
  });

  test("a party or item of another company is refused", async () => {
    await expect(doc({ party_id: await newParty("Elsewhere Ltd", other) })).rejects.toThrow(/not one of this company's parties/);
    const { id } = await doc();
    const { id: theirs } = await one<{ id: number }>(db`insert into items (company_id, code, name, type, unit_id, gst_rate_id) values (${other}, 'X-1', 'Theirs', 'raw', ${NOS}, ${G18}) returning id`);
    await expect(db`insert into document_lines (document_id, position, item_id, qty, rate, gst_rate) values (${id}, 1, ${theirs}, 1, 100, 18)`).rejects.toThrow(/not one of this company's items/);
  });
});

describe("lines and links", () => {
  test("lines copy the item's name, HSN and unit, and come back in order", async () => {
    const { id } = await doc();
    await db`insert into document_lines (document_id, position, item_id, qty, rate, discount_bp, gst_rate) values (${id}, 2, ${ITEM}, 500, 1250, 1000, 18), (${id}, 1, ${ITEM}, 100, 1300, 0, 18)`;
    await db`update items set name = 'Hex Bolt M10 x 50', hsn = '7318' where id = ${ITEM}`;
    await db`update document_lines set qty = 100 where document_id = ${id} and position = 1`; // editing a line keeps its copy
    const { lines } = (await get(id))!;
    expect(lines.map((l: Row) => [l.position, l.item_name, l.hsn, l.unit, l.unit_decimals, l.qty, l.discount_bp, l.gst_rate])).toEqual([
      [1, "Hex Bolt M10", "73181500", "NOS", 0, 100, 0, 18],
      [2, "Hex Bolt M10", "73181500", "NOS", 0, 500, 1000, 18],
    ]);
    await expect(db`insert into document_lines (document_id, position, item_id, qty, rate, gst_rate) values (${id}, 1, ${ITEM}, 1, 1, 18)`).rejects.toThrow(/document_lines_document_id_position_key/);
    await expect(db`insert into document_lines (document_id, position, item_id, qty, rate, gst_rate) values (${id}, 3, ${ITEM}, 0, 1, 18)`).rejects.toThrow(/qty_check/);
  });

  test("links record how much of a line went into the next document's line", async () => {
    const line = async (type: string) => {
      const { id } = await doc({ type });
      return (await one<{ id: number }>(db`insert into document_lines (document_id, position, item_id, qty, rate, gst_rate) values (${id}, 1, ${ITEM}, 1000, 100, 18) returning id`)).id;
    };
    const [so, ch1, ch2] = [await line("sales_order"), await line("invoice"), await line("invoice")];
    await db`insert into document_links (from_line_id, to_line_id, qty) values (${so}, ${ch1}, 400), (${so}, ${ch2}, 250)`;
    const { pending } = await one<{ pending: number }>(db`select (l.qty - sum(k.qty))::int as pending from document_lines l join document_links k on k.from_line_id = l.id where l.id = ${so} group by l.qty`);
    expect(pending).toBe(350);
    await expect(db`insert into document_links (from_line_id, to_line_id, qty) values (${so}, ${so}, 1)`).rejects.toThrow(/check/);
  });
});

describe("list", () => {
  test("one type and FY, newest first; search on number or party; status filter; paged with a total", async () => {
    const party = await newParty("Zeta Forgings");
    const q = (await doc({ type: "quotation", party_id: party, date: "2026-05-01" })).id;
    const q2 = (await doc({ type: "quotation", party_id: party, date: "2026-06-01", number: "QT/26-27/0007", status: "sent" })).id;
    await doc({ type: "quotation", party_id: party, date: "2027-05-01", fy: 2027 });
    const run = (extra: Row) => listQuery.run(db, { company_id: co, type: "quotation", fy: 2026, q: null, status: null, limit: 50, offset: 0, ...extra });
    expect((await run({})).map((r) => r.id)).toEqual([q2, q]);
    expect((await run({ q: "zeta" })).map((r) => r.id)).toEqual([q2, q]);
    expect((await run({ q: "0007" })).map((r) => r.id)).toEqual([q2]);
    expect((await run({ status: "draft" })).map((r) => r.id)).toEqual([q]);
    const page = await run({ limit: 1, offset: 1 });
    expect(page.map((r) => [r.id, r.total])).toEqual([[q, 2]]);
  });
});
