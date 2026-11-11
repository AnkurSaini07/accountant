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
      const user = (await upsertUser.run(db, { sub: `ledgers-${role}`, email: null, name: role, role }))!;
      return [role, `session=${(await createSession(db, user.id)).token}`] as const;
    }),
  ),
) as Record<Role, string>;
const call = (method: string, path: string, body?: unknown, role: Role = "accountant") =>
  app.request(`/api${path}`, {
    method,
    headers: { cookie: cookies[role], ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON for assertions
const json = async (res: Response) => (await res.json()) as any;
const fields = async (res: Response) => (await json(res)).error.details.fields as Record<string, string[]>;

const [{ id: co }] = await db`select id from companies order by id limit 1`;
const groupId = async (name: string, company = co) => ((await db`select id from ledger_groups where company_id = ${company} and name = ${name}`) as { id: number }[])[0]!.id;
const BANK = await groupId("Bank Accounts");
const EXPENSES = await groupId("Indirect Expenses");
const [{ id: other }] = await db`insert into companies (legal_name, state_code) values ('Other Firm', '07') returning id`;
const OTHER_BANK = await groupId("Bank Accounts", other);
const CASH = ((await db`select id from ledgers where company_id = ${co} and system_key = 'cash'`) as { id: number }[])[0]!.id;

describe("GET /ledger-groups", () => {
  test("the chart of accounts as a tree: primary groups with their sub-groups nested", async () => {
    const { groups } = await json(await call("GET", "/ledger-groups", undefined, "viewer"));
    expect(groups.length).toBe(12);
    const assets = groups.find((g: { name: string }) => g.name === "Current Assets");
    expect(assets).toMatchObject({ parent_id: null, nature: "asset", is_system: true });
    expect(assets.children.map((g: { name: string }) => g.name)).toEqual(["Bank Accounts", "Cash-in-Hand", "Deposits (Asset)", "Loans & Advances (Asset)", "Stock-in-Hand", "Sundry Debtors"]);
    expect(assets.children[0]).toEqual({ id: BANK, parent_id: assets.id, name: "Bank Accounts", nature: "asset", is_system: true, children: [] });
  });
});

describe("create and read", () => {
  test("an accountant creates a bank ledger (name trimmed); anyone reads it with its group", async () => {
    const res = await call("POST", "/ledgers", { name: "  HDFC Current A/c 5010 ", group_id: BANK });
    expect(res.status).toBe(201);
    const ledger = await json(res);
    expect(ledger).toMatchObject({ name: "HDFC Current A/c 5010", group_id: BANK, group_name: "Bank Accounts", nature: "asset", is_system: false, active: true });
    expect(await json(await call("GET", `/ledgers/${ledger.id}`, undefined, "viewer"))).toEqual(ledger);
  });

  test("a duplicate name (any case) is a 409 on name", async () => {
    const res = await call("POST", "/ledgers", { name: "hdfc current a/c 5010", group_id: EXPENSES });
    expect(res.status).toBe(409);
    expect((await fields(res)).name).toEqual(["A ledger named hdfc current a/c 5010 already exists."]);
  });

  test("an unknown group, or another company's, is a 400 on group_id", async () => {
    for (const group_id of [999_999, OTHER_BANK]) {
      const res = await call("POST", "/ledgers", { name: `Stray ${group_id}`, group_id });
      expect(res.status).toBe(400);
      expect((await fields(res)).group_id).toEqual(["Choose a group from the list."]);
    }
  });

  test("validation: name required, group required", async () => {
    const res = await call("POST", "/ledgers", { name: " ", group_id: 0 });
    expect(res.status).toBe(400);
    expect(Object.keys(await fields(res)).sort()).toEqual(["group_id", "name"]);
  });

  test("404 for an unknown id; 400 for a malformed one", async () => {
    expect((await call("GET", "/ledgers/999999")).status).toBe(404);
    expect((await call("GET", "/ledgers/x")).status).toBe(400);
  });
});

describe("update and deactivate", () => {
  test("rename and move a user ledger", async () => {
    const { id } = await json(await call("POST", "/ledgers", { name: "Factory Rent", group_id: BANK }));
    const res = await call("PUT", `/ledgers/${id}`, { name: "Factory Rent Faridabad", group_id: EXPENSES }, "admin");
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ name: "Factory Rent Faridabad", group_name: "Indirect Expenses", nature: "expense" });
    for (const group_id of [999_999, OTHER_BANK]) {
      expect((await fields(await call("PUT", `/ledgers/${id}`, { name: "Factory Rent Faridabad", group_id }))).group_id).toEqual(["Choose a group from the list."]);
    }
    expect((await call("PUT", `/ledgers/${id}`, { name: "Cash", group_id: EXPENSES })).status).toBe(409);
    expect((await call("PUT", "/ledgers/999999", { name: "Nope", group_id: EXPENSES })).status).toBe(404);
  });

  test("deactivated ledgers leave the list unless asked; reactivate brings them back", async () => {
    const { id } = await json(await call("POST", "/ledgers", { name: "Old SBI A/c", group_id: BANK }));
    expect(await json(await call("POST", `/ledgers/${id}/deactivate`))).toMatchObject({ active: false });
    const names = async (qs: string) => (await json(await call("GET", `/ledgers?q=sbi${qs}`))).ledgers.map((l: { name: string }) => l.name);
    expect(await names("")).toEqual([]);
    expect(await names("&include_inactive=true")).toEqual(["Old SBI A/c"]);
    expect(await json(await call("POST", `/ledgers/${id}/reactivate`))).toMatchObject({ active: true });
    expect(await names("")).toEqual(["Old SBI A/c"]);
  });

  test("system ledgers can't be edited, moved or deactivated", async () => {
    for (const [method, path, body] of [
      ["PUT", `/ledgers/${CASH}`, { name: "Petty Cash", group_id: EXPENSES }],
      ["POST", `/ledgers/${CASH}/deactivate`, undefined],
    ] as const) {
      const res = await call(method, path, body, "admin");
      expect(res.status).toBe(409);
      expect((await json(res)).error.message).toBe("Cash is a system ledger and can't be changed.");
    }
    expect(await json(await call("GET", `/ledgers/${CASH}`))).toMatchObject({ name: "Cash", group_name: "Cash-in-Hand", is_system: true, active: true });
  });
});

describe("list", () => {
  test("search matches ledger or group name, case-insensitive, LIKE wildcards literal; paged with a total", async () => {
    const all = await json(await call("GET", "/ledgers?page_size=200", undefined, "viewer"));
    expect(all.ledgers.map((l: { name: string }) => l.name)).toContain("Output CGST");
    // Grouped: by group name, then ledger name (the ledger list shows them so, #36).
    const keys = all.ledgers.map((l: { group_name: string; name: string }) => [l.group_name.toLowerCase(), l.name.toLowerCase()]);
    expect(keys).toEqual([...keys].sort((a: string[], b: string[]) => a[0]!.localeCompare(b[0]!) || a[1]!.localeCompare(b[1]!)));
    expect(keys[0]).toEqual(["bank accounts", expect.any(String)]);
    expect((await json(await call("GET", "/ledgers?q=DUTIES"))).ledgers.length).toBe(6);
    expect((await json(await call("GET", "/ledgers?q=%25"))).total).toBe(0);
    const page = await json(await call("GET", "/ledgers?page=2&page_size=3"));
    expect(page).toMatchObject({ total: all.total, page: 2, page_size: 3 });
    expect(page.ledgers.map((l: { id: number }) => l.id)).toEqual(all.ledgers.slice(3, 6).map((l: { id: number }) => l.id));
  });
});

describe("roles", () => {
  test("operators and viewers read but can't write", async () => {
    for (const role of ["operator", "viewer"] as const) {
      expect((await call("GET", "/ledgers", undefined, role)).status).toBe(200);
      expect((await call("POST", "/ledgers", { name: `By ${role}`, group_id: BANK }, role)).status).toBe(403);
      expect((await call("POST", `/ledgers/${CASH}/deactivate`, undefined, role)).status).toBe(403);
    }
  });
});
