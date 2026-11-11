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
      const user = (await upsertUser.run(db, { sub: `items-${role}`, email: null, name: role, role }))!;
      return [role, `session=${(await createSession(db, user.id)).token}`] as const;
    }),
  ),
) as Record<Role, string>;
const call = (method: string, path: string, body?: unknown, role: Role = "accountant") =>
  app.request(`/api/items${path}`, {
    method,
    headers: { cookie: cookies[role], ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON for assertions
const json = async (res: Response) => (await res.json()) as any;
const fields = async (res: Response) => (await json(res)).error.details.fields as Record<string, string[]>;

const id = async (sql: Promise<unknown>) => ((await sql) as { id: number }[])[0]!.id;
const NOS = await id(db`select id from units where code = 'NOS'`);
const KGS = await id(db`select id from units where code = 'KGS'`);
const GST18 = await id(db`select id from gst_rates where rate = 18 limit 1`);

const bolt = {
  code: " FG-101 ", name: "Hex Bolt M10 x 50", description: "Zinc plated", type: "finished", hsn: "7318 1500",
  unit_id: NOS, gst_rate_id: GST18, sale_price: 12_50, purchase_price: 9_00, opening_qty: 5_000, opening_value: 45_000_00, reorder_level: 1_000,
};
const svc = (code: string, extra: object = {}) => ({ code, name: code, type: "service", unit_id: NOS, gst_rate_id: GST18, ...extra });

describe("create and read", () => {
  test("POST creates (code trimmed, HSN spaces removed); GET returns it with unit and rate", async () => {
    const res = await call("POST", "", bolt);
    expect(res.status).toBe(201);
    const item = await json(res);
    expect(item).toMatchObject({ code: "FG-101", hsn: "73181500", unit: "NOS", unit_decimals: 0, gst_rate: 18, sale_price: 12_50, opening_qty: 5_000, active: true });
    expect(await json(await call("GET", `/${item.id}`, undefined, "viewer"))).toEqual(item);
  });

  test("defaults: description empty, money and stock 0, no reorder level", async () => {
    expect(await json(await call("POST", "", svc("SVC-MIN")))).toMatchObject({ description: "", hsn: null, sale_price: 0, opening_qty: 0, reorder_level: null });
  });

  test("404 for an unknown id; 400 for a malformed one", async () => {
    expect((await call("GET", "/999999")).status).toBe(404);
    expect((await call("GET", "/x")).status).toBe(400);
  });

  test("a duplicate code (any case) is a 409 on code", async () => {
    const res = await call("POST", "", { ...bolt, code: "fg-101" });
    expect(res.status).toBe(409);
    expect((await fields(res)).code).toEqual(["Item code fg-101 is already used."]);
  });

  test("a unit or GST rate that doesn't exist is a 400 on that field", async () => {
    expect((await fields(await call("POST", "", svc("NOUNIT", { unit_id: 999_999 })))).unit_id).toEqual(["Choose a unit from the list."]);
    expect((await fields(await call("POST", "", svc("NORATE", { gst_rate_id: 999_999 })))).gst_rate_id).toEqual(["Choose a GST rate from the list."]);
  });
});

describe("validation", () => {
  test("field checks", async () => {
    const res = await call("POST", "", {
      code: "has space", name: " ", type: "widget", hsn: "73181", unit_id: 0, gst_rate_id: -1, sale_price: 1.5, purchase_price: -1, opening_qty: Number.MAX_SAFE_INTEGER + 2,
    });
    expect(res.status).toBe(400);
    expect(Object.keys(await fields(res)).sort()).toEqual(["code", "gst_rate_id", "hsn", "name", "opening_qty", "purchase_price", "sale_price", "type", "unit_id"]);
  });

  test("services hold no stock; an opening value needs a quantity", async () => {
    const res = await call("POST", "", svc("SVC-STOCK", { opening_qty: 1, opening_value: 100, reorder_level: 0 }));
    expect(await fields(res)).toEqual({ opening_qty: ["A service has no stock."], opening_value: ["A service has no stock."], reorder_level: ["A service has no stock."] });
    const goods = await call("POST", "", { ...bolt, code: "NOQTY", opening_qty: 0, opening_value: 100 });
    expect((await fields(goods)).opening_value).toEqual(["Enter the opening quantity this value is for."]);
  });
});

describe("update and deactivate", () => {
  test("PUT replaces the item; a code clash on update is a 409; unknown id 404", async () => {
    const { id: rid } = await json(await call("POST", "", { ...bolt, code: "RM-1", name: "MS Rod", type: "raw", unit_id: KGS, hsn: null, opening_qty: 1_250, opening_value: 75_00 }));
    const res = await call("PUT", `/${rid}`, { ...bolt, code: "RM-1", name: "MS Rod 12mm", type: "raw", unit_id: KGS, hsn: "7214", opening_qty: 2_500, opening_value: 150_00 });
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ id: rid, name: "MS Rod 12mm", unit: "KGS", unit_decimals: 3, hsn: "7214", opening_qty: 2_500 });
    expect((await call("PUT", `/${rid}`, { ...bolt, code: "FG-101" })).status).toBe(409);
    expect((await call("PUT", "/999999", svc("NOBODY"))).status).toBe(404);
  });

  test("deactivate hides from the list; reactivate brings it back; no delete", async () => {
    const { id: did } = await json(await call("POST", "", svc("DORMANT", { name: "Dormant Service" })));
    expect(await json(await call("POST", `/${did}/deactivate`))).toMatchObject({ active: false });
    expect((await json(await call("GET", "?q=Dormant"))).total).toBe(0);
    expect((await json(await call("GET", "?q=Dormant&include_inactive=true"))).items).toMatchObject([{ id: did, active: false }]);
    expect(await json(await call("POST", `/${did}/reactivate`))).toMatchObject({ active: true });
    expect((await call("DELETE", `/${did}`)).status).toBe(404);
    expect((await call("POST", "/999999/deactivate")).status).toBe(404);
  });
});

describe("list", () => {
  test("search, type filter and pages", async () => {
    for (const n of ["Search A", "Search B", "Search C"]) await call("POST", "", { ...bolt, code: n.replace(" ", "-"), name: n });
    await call("POST", "", svc("SEARCH-S", { name: "Search Service" }));
    const page1 = await json(await call("GET", "?q=search&type=finished&page_size=2", undefined, "viewer"));
    expect([page1.total, page1.page, page1.page_size, page1.items.map((i: { name: string }) => i.name)]).toEqual([3, 1, 2, ["Search A", "Search B"]]);
    expect((await json(await call("GET", "?q=search&type=finished&page_size=2&page=2"))).items.map((i: { name: string }) => i.name)).toEqual(["Search C"]);
    expect((await json(await call("GET", "?q=search&type=service"))).items.map((i: { name: string }) => i.name)).toEqual(["Search Service"]);
    expect((await json(await call("GET", "?q=7318"))).items.map((i: { code: string }) => i.code)).toContain("FG-101"); // by HSN
  });

  test("bad query parameters → 400", async () => {
    for (const q of ["?type=widget", "?page=0", "?page_size=500", "?include_inactive=1"]) expect((await call("GET", q)).status).toBe(400);
  });
});

describe("roles", () => {
  test("viewers and operators read but can't write; accountants and admins can", async () => {
    const { id: rid } = await json(await call("POST", "", svc("ROLE-CHECK")));
    for (const role of ["viewer", "operator"] as const) {
      expect((await call("GET", `/${rid}`, undefined, role)).status).toBe(200);
      for (const [method, path, body] of [["POST", "", svc(`BY-${role}`)], ["PUT", `/${rid}`, svc("ROLE-CHECK")], ["POST", `/${rid}/deactivate`, undefined]] as const) {
        expect((await call(method, path, body, role)).status).toBe(403);
      }
    }
    expect((await call("POST", "", svc("BY-ADMIN"), "admin")).status).toBe(201);
    expect((await app.request("/api/items")).status).toBe(401);
  });
});
