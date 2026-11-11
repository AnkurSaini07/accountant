import { describe, expect, test } from "bun:test";
import { gstinCheckChar } from "../../shared/gstin.ts";
import { createApp } from "../app.ts";
import type { Oidc, Role } from "../auth/oidc.ts";
import { ROLES } from "../auth/oidc.ts";
import { createSession } from "../auth/sessions.ts";
import upsertUser from "../auth/upsert_user.sql";
import { testDb } from "../test/db.ts";

const db = await testDb();
const app = createApp({ db, oidc: {} as Oidc });
const cookies = Object.fromEntries(
  await Promise.all(
    ROLES.map(async (role) => {
      const user = (await upsertUser.run(db, { sub: `company-${role}`, email: null, name: role, role }))!;
      return [role, `session=${(await createSession(db, user.id)).token}`] as const;
    }),
  ),
) as Record<Role, string>;

const HR = "06AAPFU0939F1Z" + gstinCheckChar("06AAPFU0939F1Z"); // a valid Haryana GSTIN
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const profile = {
  legal_name: "Saini Engineering Works",
  trade_name: "SEW",
  gstin: HR.toLowerCase().replace(/(.{5})/, "$1 "), // normalised by the API
  phone: "+91 98100 00000",
  email: "accounts@sew.example",
  logo: PNG,
  signature: null,
  terms: "Goods once sold will not be taken back.",
  addresses: [
    { label: "Registered office", address: "Plot 12, Sector 24", city: "Faridabad", pincode: "121 005", is_primary: true },
    { label: "Godown", address: "Village Mujesar", city: "Faridabad", pincode: "121003" },
  ],
  bank_accounts: [
    { bank_name: "HDFC Bank", account_number: "5010 0012 3456 78", ifsc: "hdfc0001234", branch: "Sector 16", is_default: true },
    { bank_name: "State Bank of India", account_name: "SEW Payroll", account_number: "30000000001", ifsc: "SBIN0001234" },
  ],
};

const get = (role: Role) => app.request("/api/company", { headers: { cookie: cookies[role] } });
const put = (role: Role, body: unknown) =>
  app.request("/api/company", { method: "PUT", headers: { cookie: cookies[role], "content-type": "application/json" }, body: JSON.stringify(body) });
const fields = async (res: Response) => ((await res.json()) as { error: { details: { fields: Record<string, string[]> } } }).error.details.fields;

describe("GET /api/company", () => {
  test("every role sees the seeded company", async () => {
    for (const role of ROLES) {
      const res = await get(role);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        legal_name: "My Company",
        state_code: "06",
        gstin: null,
        addresses: [{ label: "Registered office", city: "Faridabad", is_primary: true }],
        bank_accounts: [],
      });
    }
  });

  test("401 when signed out", async () => {
    expect((await app.request("/api/company")).status).toBe(401);
  });
});

describe("PUT /api/company", () => {
  test("only admin can update", async () => {
    for (const role of ["accountant", "operator", "viewer"] as const) {
      const res = await put(role, profile);
      expect(res.status).toBe(403);
    }
    expect((await (await get("viewer")).json()).legal_name).toBe("My Company");
  });

  test("admin saves; GSTIN is normalised and decides state and PAN", async () => {
    const res = await put("admin", { ...profile, state_code: "27", pan: "ZZZZZ9999Z" }); // both ignored
    expect(res.status).toBe(200);
    const saved = await res.json();
    expect(saved).toMatchObject({ legal_name: "Saini Engineering Works", gstin: HR, state_code: "06", pan: "AAPFU0939F", logo: PNG });
    expect(await (await get("operator")).json()).toEqual(saved);
  });

  test("addresses and bank accounts: several of each, in order, normalised; saving replaces the lists", async () => {
    const saved = await (await put("admin", profile)).json();
    expect(saved.addresses).toEqual([
      { id: expect.any(Number), label: "Registered office", address: "Plot 12, Sector 24", city: "Faridabad", pincode: "121005", is_primary: true },
      { id: expect.any(Number), label: "Godown", address: "Village Mujesar", city: "Faridabad", pincode: "121003", is_primary: false },
    ]);
    expect(saved.bank_accounts).toEqual([
      { id: expect.any(Number), bank_name: "HDFC Bank", account_name: null, account_number: "50100012345678", ifsc: "HDFC0001234", branch: "Sector 16", is_default: true },
      { id: expect.any(Number), bank_name: "State Bank of India", account_name: "SEW Payroll", account_number: "30000000001", ifsc: "SBIN0001234", branch: null, is_default: false },
    ]);

    const fewer = await (await put("admin", { ...profile, addresses: [profile.addresses[0]], bank_accounts: [] })).json();
    expect(fewer.addresses.map((a: { label: string }) => a.label)).toEqual(["Registered office"]);
    expect(fewer.bank_accounts).toEqual([]);
  });

  test("exactly one primary address and one default bank account; no duplicate accounts", async () => {
    const [office, godown] = profile.addresses as [(typeof profile.addresses)[0], (typeof profile.addresses)[1]];
    const [hdfc, sbi] = profile.bank_accounts as [(typeof profile.bank_accounts)[0], (typeof profile.bank_accounts)[1]];
    const cases: [unknown, string][] = [
      [{ addresses: [] }, "addresses"],
      [{ addresses: [{ ...office, is_primary: false }, godown] }, "addresses"],
      [{ addresses: [office, { ...godown, is_primary: true }] }, "addresses"],
      [{ bank_accounts: [{ ...hdfc, is_default: false }, sbi] }, "bank_accounts"],
      [{ bank_accounts: [hdfc, { ...sbi, is_default: true }] }, "bank_accounts"],
      [{ bank_accounts: [hdfc, { ...sbi, account_number: hdfc.account_number }] }, "bank_accounts"],
      [{ bank_accounts: [{ ...hdfc, ifsc: "HDFC1234567" }] }, "bank_accounts.0.ifsc"],
      [{ addresses: [{ ...office, label: " ", pincode: "012345" }] }, "addresses.0.label"],
    ];
    for (const [change, field] of cases) {
      const res = await put("admin", { ...profile, ...(change as object) });
      expect(res.status).toBe(400);
      expect(Object.keys(await fields(res))).toContain(field);
    }
  });

  test("invalid GSTIN is rejected with the validator's reason", async () => {
    const bad = HR.slice(0, 14) + (HR.endsWith("A") ? "B" : "A");
    const res = await put("admin", { ...profile, gstin: bad });
    expect(res.status).toBe(400);
    expect((await fields(res)).gstin).toEqual([expect.stringMatching(/check digit/)]);
  });

  test("without a GSTIN: state is required and must exist; PAN is optional but checked", async () => {
    const noGst = { ...profile, gstin: "" };
    expect((await fields(await put("admin", noGst))).state_code).toBeDefined();
    expect((await fields(await put("admin", { ...noGst, state_code: "99" }))).state_code).toBeDefined();
    expect((await fields(await put("admin", { ...noGst, state_code: "07", pan: "ABC" }))).pan).toBeDefined();

    const res = await put("admin", { ...noGst, state_code: "7", pan: "aapfu 0939f" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ gstin: null, state_code: "07", pan: "AAPFU0939F" });
  });

  test("field checks: name, PIN, email, IFSC, images", async () => {
    const res = await put("admin", {
      ...profile,
      legal_name: "  ",
      email: "nope",
      signature: "data:image/svg+xml;base64,PHN2Zz4=",
      logo: `data:image/png;base64,${"A".repeat(400_000)}`,
    });
    expect(res.status).toBe(400);
    expect(Object.keys(await fields(res)).sort()).toEqual(["email", "legal_name", "logo", "signature"]);
  });

  test("blank optional fields are stored as null", async () => {
    const res = await put("admin", { legal_name: "Minimal", state_code: "06", trade_name: "", email: "", addresses: [{ label: "Office", is_primary: true }] });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      legal_name: "Minimal", trade_name: null, email: null, logo: null, terms: "",
      addresses: [{ label: "Office", address: "", city: "", pincode: null }],
      bank_accounts: [],
    });
  });
});

describe("database constraints", () => {
  test("at most one primary address and one default account per company", async () => {
    const [{ id }] = await db`select id from companies limit 1`;
    await expect(db`insert into company_addresses (company_id, label, is_primary) values (${id}, 'x', true), (${id}, 'y', true)`).rejects.toThrow(/one_primary/);
    await expect(
      db`insert into company_bank_accounts (company_id, bank_name, account_number, ifsc, is_default)
         values (${id}, 'A', '111111', 'HDFC0000001', true), (${id}, 'B', '222222', 'HDFC0000001', true)`,
    ).rejects.toThrow(/one_default/);
  });

  test("GSTIN, state and PAN can't disagree even outside the API", async () => {
    await expect(db`update companies set gstin = ${HR}, state_code = '27', pan = 'AAPFU0939F'`).rejects.toThrow(/check/);
  });
});
