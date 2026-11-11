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
      const user = (await upsertUser.run(db, { sub: `parties-${role}`, email: null, name: role, role }))!;
      return [role, `session=${(await createSession(db, user.id)).token}`] as const;
    }),
  ),
) as Record<Role, string>;

const call = (method: string, path: string, body?: unknown, role: Role = "accountant") =>
  app.request(`/api/parties${path}`, {
    method,
    headers: { cookie: cookies[role], ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const json = async (res: Response) => (await res.json()) as any;
const fields = async (res: Response) => (await json(res)).error.details.fields as Record<string, string[]>;

const DL = "07AABCS1234A1Z" + gstinCheckChar("07AABCS1234A1Z");
const sharma = {
  name: "Sharma Steels Pvt Ltd",
  kind: "customer",
  registration_type: "regular",
  gstin: DL.toLowerCase(),
  contact_person: "R. Sharma",
  phone: "9811000001",
  email: "accounts@sharma.example",
  credit_days: 30,
  credit_limit: 50_00_000_00,
  opening_balance: -1_23_456_78,
  addresses: [
    { kind: "billing", address: "12 Okhla Phase II", city: "New Delhi", pincode: "110 020", state_code: "7" },
    { kind: "shipping", label: "Plant 2", city: "Faridabad", state_code: "06" },
  ],
};
const walkIn = (name: string, extra: object = {}) => ({ name, kind: "customer", registration_type: "consumer", state_code: "06", ...extra });

describe("create and read", () => {
  test("POST creates; GSTIN normalised and decides state and PAN; GET returns it", async () => {
    const res = await call("POST", "", { ...sharma, state_code: "27", pan: "ZZZZZ9999Z" }); // both ignored
    expect(res.status).toBe(201);
    const party = await json(res);
    expect(party).toMatchObject({
      name: "Sharma Steels Pvt Ltd", gstin: DL, state_code: "07", pan: "AABCS1234A", credit_limit: 50_00_000_00, opening_balance: -1_23_456_78, active: true,
      addresses: [{ kind: "billing", pincode: "110020", state_code: "07" }, { kind: "shipping", label: "Plant 2", address: "", state_code: "06" }],
    });
    expect(await json(await call("GET", `/${party.id}`, undefined, "viewer"))).toEqual(party);
  });

  test("404 for an unknown or malformed id", async () => {
    expect((await call("GET", "/999999")).status).toBe(404);
    expect((await call("GET", "/abc")).status).toBe(400);
  });

  test("duplicate GSTIN → 409 on the GSTIN field", async () => {
    const res = await call("POST", "", { ...sharma, name: "Sharma Again" });
    expect(res.status).toBe(409);
    expect((await json(res)).error).toMatchObject({ code: "CONFLICT", details: { fields: { gstin: ["A party with this GSTIN already exists."] } } });
  });
});

describe("validation", () => {
  test("invalid GSTIN is rejected with the checker's reason", async () => {
    const bad = DL.slice(0, 14) + (DL.endsWith("A") ? "B" : "A");
    expect((await fields(await call("POST", "", { ...sharma, gstin: bad }))).gstin).toEqual([expect.stringMatching(/check digit/)]);
  });

  test("registration type and GSTIN must agree; unregistered needs a state", async () => {
    expect((await fields(await call("POST", "", { ...sharma, gstin: "" }))).gstin).toEqual(["GSTIN is required for a registered party."]);
    expect((await fields(await call("POST", "", walkIn("Has GST", { gstin: DL })))).gstin).toBeDefined();
    expect((await fields(await call("POST", "", walkIn("No State", { state_code: "" })))).state_code).toBeDefined();
    expect((await fields(await call("POST", "", walkIn("Bad State", { state_code: "99" })))).state_code).toBeDefined();
  });

  test("field checks", async () => {
    const res = await call("POST", "", {
      ...walkIn(" "), kind: "vendor", email: "nope", credit_days: 400, credit_limit: -1, opening_balance: 1.5, pan: "ABC",
      addresses: [{ kind: "billing", state_code: "06" }, { kind: "billing", state_code: "06", pincode: "012345" }],
    });
    expect(res.status).toBe(400);
    expect(Object.keys(await fields(res)).sort()).toEqual(
      ["addresses", "addresses.1.pincode", "credit_days", "credit_limit", "email", "kind", "name", "opening_balance", "pan"].sort(),
    );
  });
});

describe("update and deactivate", () => {
  test("PUT replaces the party and its addresses", async () => {
    const { id } = await json(await call("POST", "", walkIn("Gupta Traders", { addresses: [{ kind: "billing", state_code: "06", city: "Palwal" }] })));
    const res = await call("PUT", `/${id}`, walkIn("Gupta Traders & Sons", { kind: "both", phone: "9999900000", addresses: [] }));
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ id, name: "Gupta Traders & Sons", kind: "both", phone: "9999900000", addresses: [] });
    expect((await call("PUT", "/999999", walkIn("Nobody"))).status).toBe(404);
  });

  test("PUT to another party's GSTIN → 409", async () => {
    const { id } = await json(await call("POST", "", walkIn("Will Clash")));
    expect((await call("PUT", `/${id}`, { ...sharma, name: "Will Clash" })).status).toBe(409);
  });

  test("deactivate hides from the list; reactivate brings it back; never deleted", async () => {
    const { id } = await json(await call("POST", "", walkIn("Mehta Brothers")));
    expect(await json(await call("POST", `/${id}/deactivate`))).toMatchObject({ id, active: false });
    expect((await json(await call("GET", "?q=Mehta"))).total).toBe(0);
    expect((await json(await call("GET", "?q=Mehta&include_inactive=true"))).parties).toMatchObject([{ id, active: false }]);
    expect((await call("GET", `/${id}`)).status).toBe(200);
    expect(await json(await call("POST", `/${id}/reactivate`))).toMatchObject({ active: true });
    expect((await call("DELETE", `/${id}`)).status).toBe(404); // no delete route
    expect((await call("POST", "/999999/deactivate")).status).toBe(404);
  });
});

describe("list", () => {
  test("search, kind filter and pages", async () => {
    for (const n of ["Search A", "Search B", "Search C"]) await call("POST", "", walkIn(n));
    await call("POST", "", walkIn("Search Supplier", { kind: "supplier" }));
    const page1 = await json(await call("GET", "?q=search&kind=customer&page_size=2", undefined, "viewer"));
    expect([page1.total, page1.page, page1.page_size, page1.parties.map((p: { name: string }) => p.name)]).toEqual([3, 1, 2, ["Search A", "Search B"]]);
    const page2 = await json(await call("GET", "?q=search&kind=customer&page_size=2&page=2"));
    expect(page2.parties.map((p: { name: string }) => p.name)).toEqual(["Search C"]);
    expect((await json(await call("GET", "?q=search&kind=supplier"))).parties.map((p: { name: string }) => p.name)).toEqual(["Search Supplier"]);
  });

  test("bad query parameters → 400", async () => {
    for (const q of ["?kind=vendor", "?page=0", "?page_size=500", "?include_inactive=yes"]) expect((await call("GET", q)).status).toBe(400);
  });
});

describe("roles", () => {
  test("viewer reads but can't write; operator, accountant and admin can", async () => {
    const { id } = await json(await call("POST", "", walkIn("Role Check")));
    for (const [method, path, body] of [["POST", "", walkIn("V")], ["PUT", `/${id}`, walkIn("V")], ["POST", `/${id}/deactivate`, undefined]] as const) {
      expect((await call(method, path, body, "viewer")).status).toBe(403);
    }
    expect((await call("GET", `/${id}`, undefined, "viewer")).status).toBe(200);
    for (const role of ["operator", "accountant", "admin"] as const) expect((await call("POST", "", walkIn(`By ${role}`), role)).status).toBe(201);
  });

  test("signed out → 401", async () => {
    expect((await app.request("/api/parties")).status).toBe(401);
  });
});
