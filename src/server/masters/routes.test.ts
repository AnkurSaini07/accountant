import { describe, expect, test } from "bun:test";
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
      const user = (await upsertUser.run(db, { sub: `masters-${role}`, email: null, name: role, role }))!;
      return [role, `session=${(await createSession(db, user.id)).token}`] as const;
    }),
  ),
) as Record<Role, string>;
const call = (method: string, path: string, body?: unknown, role: Role = "admin") =>
  app.request(`/api${path}`, {
    method,
    headers: { cookie: cookies[role], ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const fields = async (res: Response) => ((await res.json()) as { error: { details: { fields: Record<string, string[]> } } }).error.details.fields;

describe("units", () => {
  test("seeded with the common UQCs, readable by every role", async () => {
    for (const role of ROLES) {
      const res = await call("GET", "/units", undefined, role);
      expect(res.status).toBe(200);
      const units = (await res.json()) as { code: string; decimals: number; active: boolean }[];
      expect(units.map((u) => u.code)).toEqual(expect.arrayContaining(["BOX", "KGS", "LTR", "MTR", "NOS", "PCS", "SET"]));
      expect(units.find((u) => u.code === "KGS")).toMatchObject({ name: "Kilograms", decimals: 3, active: true });
      expect(units.find((u) => u.code === "NOS")).toMatchObject({ decimals: 0 });
    }
  });

  test("admin adds a unit (code normalised); a duplicate is a 409 on code", async () => {
    const res = await call("POST", "/units", { code: " tne ", name: "Tonnes", decimals: 3 });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: expect.any(Number), code: "TNE", name: "Tonnes", decimals: 3, active: true });
    expect((await (await call("GET", "/units")).json()) as { code: string }[]).toContainEqual(expect.objectContaining({ code: "TNE" }));

    const dup = await call("POST", "/units", { code: "kgs", name: "Kilos" });
    expect(dup.status).toBe(409);
    expect((await fields(dup)).code).toEqual(["KGS already exists."]);
  });

  test("validation", async () => {
    const res = await call("POST", "/units", { code: "KG", name: " ", decimals: 4 });
    expect(res.status).toBe(400);
    expect(Object.keys(await fields(res)).sort()).toEqual(["code", "decimals", "name"]);
  });

  test("only admin can add", async () => {
    for (const role of ["accountant", "operator", "viewer"] as const) expect((await call("POST", "/units", { code: "QTL", name: "Quintal" }, role)).status).toBe(403);
  });
});

describe("GST rates", () => {
  test("seeded with every slab, including 40% from 22 Sep 2025", async () => {
    const rates = (await (await call("GET", "/gst-rates", undefined, "viewer")).json()) as { rate: number; effective_from: string; active: boolean }[];
    expect(rates.map((r) => r.rate)).toEqual([0, 0.25, 3, 5, 12, 18, 28, 40]);
    expect(rates.find((r) => r.rate === 40)).toMatchObject({ effective_from: "2025-09-22", active: true });
    expect(rates.find((r) => r.rate === 18)).toMatchObject({ effective_from: "2017-07-01" });
  });

  test("admin adds a rate with its date; the same rate and date twice is a 409", async () => {
    const res = await call("POST", "/gst-rates", { rate: 1.5, effective_from: "2026-04-01" });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ rate: 1.5, effective_from: "2026-04-01", active: true });
    // The same rate from a later date is a new row: old documents keep the old one.
    expect((await call("POST", "/gst-rates", { rate: 18, effective_from: "2027-04-01" })).status).toBe(201);

    const dup = await call("POST", "/gst-rates", { rate: 1.5, effective_from: "2026-04-01" });
    expect(dup.status).toBe(409);
    expect((await fields(dup)).rate).toEqual(["1.5% from 2026-04-01 already exists."]);
  });

  test("validation: range, 2 decimals, a real date", async () => {
    for (const [body, field] of [
      [{ rate: -1, effective_from: "2026-04-01" }, "rate"],
      [{ rate: 101, effective_from: "2026-04-01" }, "rate"],
      [{ rate: 0.125, effective_from: "2026-04-01" }, "rate"],
      [{ rate: 5, effective_from: "2026-02-30" }, "effective_from"],
      [{ rate: 5, effective_from: "22-09-2025" }, "effective_from"],
    ] as const) {
      const res = await call("POST", "/gst-rates", body);
      expect(res.status).toBe(400);
      expect(Object.keys(await fields(res))).toEqual([field]);
    }
  });

  test("only admin can add; signed out can't read", async () => {
    for (const role of ["accountant", "operator", "viewer"] as const) expect((await call("POST", "/gst-rates", { rate: 7, effective_from: "2026-04-01" }, role)).status).toBe(403);
    expect((await app.request("/api/gst-rates")).status).toBe(401);
  });

  test("the database refuses an out-of-range rate and a malformed unit code", async () => {
    await expect(db`insert into gst_rates (rate, effective_from) values (100.01, '2026-01-01')`).rejects.toThrow(/check/);
    await expect(db`insert into units (code, name) values ('kg', 'x')`).rejects.toThrow(/check/);
  });
});
