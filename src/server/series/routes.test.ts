import { describe, expect, test } from "bun:test";
import { DOC_TYPES } from "../../shared/numbering.ts";
import { createApp } from "../app.ts";
import type { Oidc, Role } from "../auth/oidc.ts";
import { ROLES } from "../auth/oidc.ts";
import { createSession } from "../auth/sessions.ts";
import upsertUser from "../auth/upsert_user.sql";
import { testDb } from "../test/db.ts";
import { nextNumber } from "./series.ts";

const db = await testDb();
const app = createApp({ db, oidc: {} as Oidc });
const [{ id: companyId }] = await db`select id from companies order by id limit 1`;
const cookies = Object.fromEntries(
  await Promise.all(
    ROLES.map(async (role) => {
      const user = (await upsertUser.run(db, { sub: `series-${role}`, email: null, name: role, role }))!;
      return [role, `session=${(await createSession(db, user.id)).token}`] as const;
    }),
  ),
) as Record<Role, string>;

const get = (fy: number | string, role: Role = "viewer") => app.request(`/api/series?fy=${fy}`, { headers: { cookie: cookies[role] } });
const put = (body: unknown, role: Role = "admin") =>
  app.request("/api/series", { method: "PUT", headers: { cookie: cookies[role], "content-type": "application/json" }, body: JSON.stringify(body) });
const fields = async (res: Response) => ((await res.json()) as { error: { details: { fields: Record<string, string[]> } } }).error.details.fields;
const invoice = (patch: object = {}) => ({ doc_type: "invoice", prefix: "INV/{FY}/", padding: 4, next_number: 1, ...patch });

describe("GET /api/series", () => {
  test("every document type, with defaults for series never used", async () => {
    const res = await get(2026);
    expect(res.status).toBe(200);
    const { fy, series } = await res.json();
    expect(fy).toBe(2026);
    expect(series.map((s: { doc_type: string }) => s.doc_type)).toEqual([...DOC_TYPES]);
    expect(series.find((s: { doc_type: string }) => s.doc_type === "invoice")).toEqual(invoice());
  });

  test("shows a series' real next number once documents have used it", async () => {
    await db.begin(async (tx) => {
      for (let i = 0; i < 3; i++) await nextNumber(tx, { companyId, docType: "challan", date: "2026-05-01" });
    });
    const { series } = await (await get(2026)).json();
    expect(series.find((s: { doc_type: string }) => s.doc_type === "challan")).toMatchObject({ prefix: "DC/{FY}/", next_number: 4 });
    expect((await (await get(2027)).json()).series.find((s: { doc_type: string }) => s.doc_type === "challan").next_number).toBe(1);
  });

  test("needs a valid fy", async () => {
    expect((await get("abc")).status).toBe(400);
    expect((await app.request("/api/series", { headers: { cookie: cookies.viewer } })).status).toBe(400);
  });
});

describe("PUT /api/series", () => {
  test("only admin", async () => {
    for (const role of ["accountant", "operator", "viewer"] as const) expect((await put({ fy: 2026, series: [invoice()] }, role)).status).toBe(403);
  });

  test("admin sets prefix, padding and a later start (e.g. continuing from Tally); documents then use it", async () => {
    const res = await put({ fy: 2026, series: [invoice({ prefix: "SEW/{FY}/", padding: 3, next_number: 143 })] });
    expect(res.status).toBe(200);
    expect((await res.json()).series.find((s: { doc_type: string }) => s.doc_type === "invoice")).toEqual(invoice({ prefix: "SEW/{FY}/", padding: 3, next_number: 143 }));
    expect(await db.begin((tx) => nextNumber(tx, { companyId, docType: "invoice", date: "2026-10-01" }))).toBe("SEW/26-27/143");
  });

  test("can't move the next number below one already used; the whole save is refused", async () => {
    // challan is at 4 (used 1-3 above); invoice at 144.
    const res = await put({ fy: 2026, series: [invoice({ prefix: "X/{FY}/", next_number: 144 }), { doc_type: "challan", prefix: "DC/", padding: 4, next_number: 2 }] });
    expect(res.status).toBe(400);
    expect(await fields(res)).toEqual({ "series.1.next_number": ["Lower than a number already used. Numbers can only move forward."] });
    const { series } = await (await get(2026)).json();
    expect(series.find((s: { doc_type: string }) => s.doc_type === "invoice").prefix).toBe("SEW/{FY}/"); // rolled back
    expect(series.find((s: { doc_type: string }) => s.doc_type === "challan").next_number).toBe(4);
    // Same number is fine (just changing the prefix).
    expect((await put({ fy: 2026, series: [{ doc_type: "challan", prefix: "DC/", padding: 4, next_number: 4 }] })).status).toBe(200);
  });

  test("validation: GST characters, 16-character limit at the next number, padding, duplicates, unknown types", async () => {
    const res = await put({
      fy: 2026,
      series: [
        invoice({ prefix: "INV #" }),
        { doc_type: "quotation", prefix: "QUOTATION/{FY}/", padding: 4, next_number: 1 }, // QUOTATION/26-27/0001 = 20
        { doc_type: "receipt", prefix: "R/", padding: 0, next_number: 0 },
        invoice(),
      ],
    });
    expect(res.status).toBe(400);
    expect(Object.keys(await fields(res)).sort()).toEqual(["series.0.prefix", "series.1.prefix", "series.2.next_number", "series.2.padding", "series.3.doc_type"]);
    expect((await put({ fy: 2026, series: [{ doc_type: "memo", prefix: "M/", padding: 4, next_number: 1 }] })).status).toBe(400);
  });
});
