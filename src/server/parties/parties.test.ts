import { describe, expect, test } from "bun:test";
import { gstinCheckChar } from "../../shared/gstin.ts";
import { testDb } from "../test/db.ts";
import { createParty, getParty, listParties, type PartyInput, setPartyActive, updateParty } from "./parties.ts";

const db = await testDb();
const [{ id: co }] = await db`select id from companies order by id limit 1`;
const [{ id: otherCo }] = await db`insert into companies (legal_name, state_code) values ('Other Firm', '07') returning id`;
const gstin = (first14: string) => first14 + gstinCheckChar(first14);
const DL = gstin("07AABCS1234A1Z"); // a Delhi company

const billing = { kind: "billing" as const, label: null, address: "12 Okhla Phase II", city: "New Delhi", pincode: "110020", state_code: "07" };
const base: PartyInput = {
  name: "Sharma Steels Pvt Ltd",
  kind: "customer",
  registration_type: "regular",
  gstin: DL,
  pan: "AABCS1234A",
  state_code: "07",
  contact_person: "R. Sharma",
  phone: "9811000001",
  email: "accounts@sharma.example",
  credit_days: 30,
  credit_limit: 50_00_000_00, // ₹50 lakh in paise
  opening_balance: -1_23_456_78, // Cr ₹1,23,456.78
  addresses: [billing, { kind: "shipping", label: "Plant 2", address: "Sector 58", city: "Faridabad", pincode: "121004", state_code: "06" }],
};
const unregistered = (name: string, patch: Partial<PartyInput> = {}): PartyInput => ({
  ...base, name, registration_type: "unregistered", gstin: null, pan: null, state_code: "06", phone: null, credit_limit: null, opening_balance: 0, addresses: [], ...patch,
});

describe("create and get", () => {
  test("round-trips every field, money exactly, addresses billing first", async () => {
    const id = await createParty(db, co, base);
    const party = await getParty(db, co, id);
    expect(party).toMatchObject({ ...base, id, active: true, addresses: [{ ...billing, id: expect.any(Number) }, { kind: "shipping", label: "Plant 2", state_code: "06" }] });
    expect(party!.credit_limit).toBe(5_000_000_00);
    expect(party!.opening_balance).toBe(-12_345_678);
  });

  test("is scoped to the company", async () => {
    const id = await createParty(db, co, unregistered("Scoped Traders"));
    expect(await getParty(db, otherCo, id)).toBeNull();
    expect(await updateParty(db, otherCo, id, unregistered("Hijack"))).toBe(false);
    expect(await setPartyActive(db, otherCo, id, false)).toBe(false);
  });

  test("the largest safe paise amount survives exactly", async () => {
    const id = await createParty(db, co, unregistered("Big Balance", { opening_balance: Number.MAX_SAFE_INTEGER }));
    expect((await getParty(db, co, id))!.opening_balance).toBe(Number.MAX_SAFE_INTEGER);
    await expect(db`update parties set opening_balance = 9007199254740992 where id = ${id}`).rejects.toThrow(/check/);
  });
});

describe("update and deactivate", () => {
  test("update replaces fields and addresses", async () => {
    const id = await createParty(db, co, unregistered("Old Name", { addresses: [{ ...billing, state_code: "06" }] }));
    expect(await updateParty(db, co, id, unregistered("New Name", { kind: "both", addresses: [] }))).toBe(true);
    expect(await getParty(db, co, id)).toMatchObject({ name: "New Name", kind: "both", addresses: [] });
    expect(await updateParty(db, co, 999_999, unregistered("Nobody"))).toBe(false);
  });

  test("deactivated parties leave the list unless asked for, and can come back", async () => {
    const id = await createParty(db, co, unregistered("Dormant Industries"));
    expect(await setPartyActive(db, co, id, false)).toBe(true);
    expect((await listParties(db, co, { q: "Dormant" })).parties).toEqual([]);
    expect((await listParties(db, co, { q: "Dormant", includeInactive: true })).parties).toMatchObject([{ id, active: false }]);
    await setPartyActive(db, co, id, true);
    expect((await listParties(db, co, { q: "Dormant" })).total).toBe(1);
  });
});

describe("list", () => {
  test("contains search on name (any case), GSTIN or phone, with billing city", async () => {
    expect((await listParties(db, co, { q: "sharma steels" })).parties).toMatchObject([{ name: "Sharma Steels Pvt Ltd", city: "New Delhi", opening_balance: -12_345_678 }]);
    expect((await listParties(db, co, { q: "steel" })).total).toBe(1);
    expect((await listParties(db, co, { q: DL.slice(2, 8).toLowerCase() })).parties[0]!.gstin).toBe(DL);
    expect((await listParties(db, co, { q: "1100000" })).parties[0]!.name).toBe("Sharma Steels Pvt Ltd");
  });

  test("% and _ in the search are literal", async () => {
    await createParty(db, co, unregistered("100% Pure Oils"));
    await createParty(db, co, unregistered("Under_score Co"));
    expect((await listParties(db, co, { q: "100%" })).parties.map((p) => p.name)).toEqual(["100% Pure Oils"]);
    expect((await listParties(db, co, { q: "%" })).parties.map((p) => p.name)).toEqual(["100% Pure Oils"]);
    expect((await listParties(db, co, { q: "_" })).parties.map((p) => p.name)).toEqual(["Under_score Co"]);
  });

  test("kind filter: 'both' parties appear under customers and suppliers", async () => {
    await createParty(db, co, unregistered("Kind Customer", { kind: "customer" }));
    await createParty(db, co, unregistered("Kind Supplier", { kind: "supplier" }));
    await createParty(db, co, unregistered("Kind Both", { kind: "both" }));
    const names = async (kind?: "customer" | "supplier") => (await listParties(db, co, { q: "Kind ", kind })).parties.map((p) => p.name);
    expect(await names("customer")).toEqual(["Kind Both", "Kind Customer"]);
    expect(await names("supplier")).toEqual(["Kind Both", "Kind Supplier"]);
    expect(await names()).toEqual(["Kind Both", "Kind Customer", "Kind Supplier"]);
  });

  test("pages by name with the full total", async () => {
    for (const n of ["Page C", "Page A", "page B", "Page D", "Page E"]) await createParty(db, co, unregistered(n));
    const first = await listParties(db, co, { q: "page ", limit: 2 });
    const second = await listParties(db, co, { q: "page ", limit: 2, offset: 2 });
    expect([first.total, first.parties.map((p) => p.name), second.parties.map((p) => p.name)]).toEqual([5, ["Page A", "page B"], ["Page C", "Page D"]]);
    expect((await listParties(db, co, { q: "page ", offset: 10 })).total).toBe(0);
  });

  test("name search can use the trigram index", async () => {
    const plan = await db.begin(async (tx) => {
      await tx`set local enable_seqscan = off`;
      return (await tx`explain select id from parties where name ilike '%steel%'`).map((r: { "QUERY PLAN": string }) => r["QUERY PLAN"]).join("\n");
    });
    expect(plan).toContain("parties_name_search");
  });
});

describe("database rules", () => {
  test("one party per GSTIN within a company; another company may have it", async () => {
    await expect(createParty(db, co, { ...base, name: "Duplicate" })).rejects.toThrow(/unique|duplicate/i);
    await expect(createParty(db, otherCo, base)).resolves.toBeNumber();
  });

  test("several unregistered parties without GSTIN are fine", async () => {
    await createParty(db, co, unregistered("Walk-in 1", { registration_type: "consumer" }));
    await expect(createParty(db, co, unregistered("Walk-in 2", { registration_type: "consumer" }))).resolves.toBeNumber();
  });

  test("registration type and GSTIN must agree; GSTIN fixes state and PAN", async () => {
    await expect(createParty(db, co, { ...base, gstin: null, pan: null })).rejects.toThrow(/check/); // regular without GSTIN
    await expect(createParty(db, co, unregistered("Has GSTIN", { gstin: gstin("06AAACA1111A1Z"), pan: "AAACA1111A" }))).rejects.toThrow(/check/);
    await expect(createParty(db, co, { ...base, gstin: gstin("07AAACB2222B1Z"), pan: "AAACB2222B", state_code: "06" })).rejects.toThrow(/check/);
  });

  test("at most one billing address; a failed save leaves nothing behind", async () => {
    const before = (await listParties(db, co, { q: "Two Billing", includeInactive: true })).total;
    await expect(createParty(db, co, unregistered("Two Billing", { addresses: [billing, billing] }))).rejects.toThrow(/one_billing/);
    expect((await listParties(db, co, { q: "Two Billing", includeInactive: true })).total).toBe(before);
  });
});
