import { describe, expect, test } from "bun:test";
import { testDb } from "../test/db.ts";
import { createItem, getItem, type ItemInput, listItems, setItemActive, updateItem } from "./items.ts";

const db = await testDb();
const [{ id: co }] = await db`select id from companies order by id limit 1`;
const [{ id: otherCo }] = await db`insert into companies (legal_name, state_code) values ('Other Firm', '07') returning id`;
const unit = async (code: string) => ((await db`select id from units where code = ${code}`) as { id: number }[])[0]!.id;
const rate = async (r: number) => ((await db`select id from gst_rates where rate = ${r} order by effective_from desc limit 1`) as { id: number }[])[0]!.id;
const KGS = await unit("KGS");
const NOS = await unit("NOS");
const GST18 = await rate(18);
const GST5 = await rate(5);

const bolt: ItemInput = {
  code: "FG-101", name: "Hex Bolt M10 x 50", description: "Zinc plated, grade 8.8", type: "finished", hsn: "73181500",
  unit_id: NOS, gst_rate_id: GST18, sale_price: 12_50, purchase_price: 0, opening_qty: 5_000, opening_value: 4_00_000_00, reorder_level: 1_000,
};
const item = (code: string, patch: Partial<ItemInput> = {}): ItemInput => ({
  ...bolt, code, name: code, description: "", hsn: null, opening_qty: 0, opening_value: 0, reorder_level: null, ...patch,
});

describe("create and get", () => {
  test("round-trips every field, with its unit and GST rate", async () => {
    const id = await createItem(db, co, bolt);
    expect(await getItem(db, co, id)).toMatchObject({
      ...bolt, id, unit: "NOS", unit_decimals: 0, gst_rate: 18, active: true,
    });
  });

  test("quantities in the smallest step: 1.250 KGS is 1250, values exact up to the largest safe amount", async () => {
    const id = await createItem(db, co, item("RM-STEEL", { type: "raw", unit_id: KGS, gst_rate_id: GST18, opening_qty: 1_250, opening_value: Number.MAX_SAFE_INTEGER }));
    expect(await getItem(db, co, id)).toMatchObject({ unit: "KGS", unit_decimals: 3, opening_qty: 1_250, opening_value: Number.MAX_SAFE_INTEGER });
  });

  test("is scoped to the company", async () => {
    const id = await createItem(db, co, item("SCOPED"));
    expect(await getItem(db, otherCo, id)).toBeNull();
    expect(await updateItem(db, otherCo, id, item("HIJACK"))).toBe(false);
    expect(await setItemActive(db, otherCo, id, false)).toBe(false);
  });
});

describe("update and deactivate", () => {
  test("update replaces the fields; unknown id is false", async () => {
    const id = await createItem(db, co, item("OLD-1"));
    expect(await updateItem(db, co, id, item("NEW-1", { name: "Renamed", gst_rate_id: GST5, sale_price: 99_00 }))).toBe(true);
    expect(await getItem(db, co, id)).toMatchObject({ code: "NEW-1", name: "Renamed", gst_rate: 5, sale_price: 99_00 });
    expect(await updateItem(db, co, 999_999, item("NOBODY"))).toBe(false);
  });

  test("deactivated items leave the list unless asked for, and can come back", async () => {
    const id = await createItem(db, co, item("DORMANT", { name: "Dormant Washer" }));
    expect(await setItemActive(db, co, id, false)).toBe(true);
    expect((await listItems(db, co, { q: "Dormant" })).items).toEqual([]);
    expect((await listItems(db, co, { q: "Dormant", includeInactive: true })).items).toMatchObject([{ id, active: false }]);
    await setItemActive(db, co, id, true);
    expect((await listItems(db, co, { q: "Dormant" })).total).toBe(1);
  });
});

describe("list", () => {
  test("contains search on code, name (any case) or HSN, with unit and rate", async () => {
    expect((await listItems(db, co, { q: "hex bolt" })).items).toMatchObject([{ code: "FG-101", unit: "NOS", gst_rate: 18, sale_price: 12_50 }]);
    expect((await listItems(db, co, { q: "fg-10" })).items.map((i) => i.code)).toContain("FG-101");
    expect((await listItems(db, co, { q: "731815" })).items.map((i) => i.code)).toEqual(["FG-101"]);
  });

  test("% and _ in the search are literal", async () => {
    await createItem(db, co, item("PCT", { name: "100% Copper Wire" }));
    await createItem(db, co, item("UND", { name: "Wire_Mesh" }));
    expect((await listItems(db, co, { q: "100%" })).items.map((i) => i.name)).toEqual(["100% Copper Wire"]);
    expect((await listItems(db, co, { q: "_" })).items.map((i) => i.name)).toEqual(["Wire_Mesh"]);
  });

  test("type filter", async () => {
    await createItem(db, co, item("T-RAW", { name: "Type Raw", type: "raw" }));
    await createItem(db, co, item("T-SVC", { name: "Type Service", type: "service" }));
    expect((await listItems(db, co, { q: "Type ", type: "service" })).items.map((i) => i.name)).toEqual(["Type Service"]);
    expect((await listItems(db, co, { q: "Type " })).total).toBe(2);
  });

  test("pages by name with the full total", async () => {
    for (const n of ["Page C", "Page A", "page B", "Page D", "Page E"]) await createItem(db, co, item(n.replace(" ", "-"), { name: n }));
    const first = await listItems(db, co, { q: "page ", limit: 2 });
    const second = await listItems(db, co, { q: "page ", limit: 2, offset: 2 });
    expect([first.total, first.items.map((i) => i.name), second.items.map((i) => i.name)]).toEqual([5, ["Page A", "page B"], ["Page C", "Page D"]]);
  });

  test("name search can use the trigram index", async () => {
    const plan = await db.begin(async (tx) => {
      await tx`set local enable_seqscan = off`;
      return (await tx`explain select id from items where name ilike '%bolt%'`).map((r: { "QUERY PLAN": string }) => r["QUERY PLAN"]).join("\n");
    });
    expect(plan).toContain("items_name_search");
  });
});

describe("database rules", () => {
  test("item code unique per company, ignoring case; another company may reuse it", async () => {
    await expect(createItem(db, co, item("fg-101"))).rejects.toThrow(/items_company_code/);
    await expect(createItem(db, otherCo, item("FG-101"))).resolves.toBeNumber();
  });

  test("HSN is 4, 6 or 8 digits", async () => {
    for (const hsn of ["7318", "731815", "73181500", "998898"]) await expect(createItem(db, co, item(`HSN-${hsn}`, { hsn }))).resolves.toBeNumber();
    for (const hsn of ["731", "73181", "7318150", "731815001", "7318AB"]) await expect(createItem(db, co, item(`BAD-${hsn}`, { hsn }))).rejects.toThrow(/check/);
  });

  test("services hold no stock; an opening value needs an opening quantity", async () => {
    await expect(createItem(db, co, item("SVC-1", { type: "service", opening_qty: 1 }))).rejects.toThrow(/check/);
    await expect(createItem(db, co, item("SVC-2", { type: "service", reorder_level: 5 }))).rejects.toThrow(/check/);
    await expect(createItem(db, co, item("NOQTY", { opening_value: 100 }))).rejects.toThrow(/check/);
  });

  test("unit and GST rate must exist; amounts can't be negative", async () => {
    await expect(createItem(db, co, item("NOUNIT", { unit_id: 999_999 }))).rejects.toThrow(/foreign key/);
    await expect(createItem(db, co, item("NORATE", { gst_rate_id: 999_999 }))).rejects.toThrow(/foreign key/);
    await expect(createItem(db, co, item("NEG", { sale_price: -1 }))).rejects.toThrow(/check/);
  });

  test("codes: letters, digits and / _ . - only, up to 30 characters", async () => {
    await expect(createItem(db, co, item("A/B_C.D-1"))).resolves.toBeNumber();
    for (const code of ["", " X", "has space", "X".repeat(31)]) await expect(createItem(db, co, item(code))).rejects.toThrow(/check/);
  });
});
