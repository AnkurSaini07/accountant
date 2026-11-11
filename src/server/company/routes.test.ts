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
  address: "Plot 12, Sector 24",
  city: "Faridabad",
  pincode: "121005",
  gstin: HR.toLowerCase().replace(/(.{5})/, "$1 "), // normalised by the API
  phone: "+91 98100 00000",
  email: "accounts@sew.example",
  bank_name: "HDFC Bank",
  bank_account: "50100012345678",
  bank_ifsc: "hdfc0001234",
  bank_branch: "Sector 16, Faridabad",
  logo: PNG,
  signature: null,
  terms: "Goods once sold will not be taken back.",
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
      expect(await res.json()).toMatchObject({ legal_name: "My Company", state_code: "06", gstin: null });
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
    expect(saved).toMatchObject({ legal_name: "Saini Engineering Works", gstin: HR, state_code: "06", pan: "AAPFU0939F", bank_ifsc: "HDFC0001234", logo: PNG });
    expect(await (await get("operator")).json()).toEqual(saved);
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
      pincode: "012345",
      email: "nope",
      bank_ifsc: "HDFC1234567",
      signature: "data:image/svg+xml;base64,PHN2Zz4=",
      logo: `data:image/png;base64,${"A".repeat(400_000)}`,
    });
    expect(res.status).toBe(400);
    expect(Object.keys(await fields(res)).sort()).toEqual(["bank_ifsc", "email", "legal_name", "logo", "pincode", "signature"]);
  });

  test("blank optional fields are stored as null", async () => {
    const res = await put("admin", { legal_name: "Minimal", state_code: "06", trade_name: "", email: "", bank_ifsc: " " });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ legal_name: "Minimal", trade_name: null, email: null, bank_ifsc: null, logo: null, address: "", terms: "" });
  });
});

describe("database constraints", () => {
  test("GSTIN, state and PAN can't disagree even outside the API", async () => {
    await expect(db`update companies set gstin = ${HR}, state_code = '27', pan = 'AAPFU0939F'`).rejects.toThrow(/check/);
  });
});
