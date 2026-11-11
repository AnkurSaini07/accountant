import { describe, expect, test } from "bun:test";
import { testDb } from "../test/db.ts";
import { createSession, deleteSession, SESSION_TTL_MS, sessionUser } from "./sessions.ts";
import upsertUser from "./upsert_user.sql";

const db = await testDb();

const login = (over: Partial<Parameters<typeof upsertUser.run>[1]> = {}) =>
  upsertUser.run(db, { sub: "sub-ravi", email: "ravi@example.com", name: "Ravi", role: "operator", ...over });

describe("upsert user by OIDC sub", () => {
  test("first login creates the user", async () => {
    const u = await login({ sub: "sub-new" });
    expect(u).toMatchObject({ oidc_sub: "sub-new", name: "Ravi", role: "operator", active: true });
  });

  test("later logins update name, email and role but keep the same user", async () => {
    const first = await login();
    const again = await login({ email: "ravi.k@example.com", name: "Ravi Kumar", role: "accountant" });
    expect(again!.id).toBe(first!.id);
    expect(again).toMatchObject({ email: "ravi.k@example.com", name: "Ravi Kumar", role: "accountant" });
    const [row] = await db`select count(*)::int as n, max(last_login_at) is not null as logged from users where oidc_sub = 'sub-ravi'`;
    expect(row).toEqual({ n: 1, logged: true });
  });

  test("the database rejects unknown roles", async () => {
    await expect(login({ sub: "sub-x", role: "superuser" as "admin" })).rejects.toThrow(/check constraint/);
  });

  test("there is no password column", async () => {
    const cols = (await db`select column_name from information_schema.columns where table_name = 'users'`).map(
      (r: { column_name: string }) => r.column_name,
    );
    expect(cols.some((c: string) => /pass|secret|hash/.test(c))).toBe(false);
  });
});

describe("sessions", () => {
  test("tokens are 256-bit random and only their hash is stored", async () => {
    const user = (await login({ sub: "sub-s1" }))!;
    const a = await createSession(db, user.id);
    const b = await createSession(db, user.id);
    expect(Buffer.from(a.token, "base64url")).toHaveLength(32);
    expect(a.token).not.toBe(b.token);
    const stored = (await db`select token_hash from sessions where user_id = ${user.id}`).map((r: { token_hash: string }) => r.token_hash);
    expect(stored).toHaveLength(2);
    expect(stored).not.toContain(a.token);
    expect(stored.every((h: string) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
  });

  test("a session token resolves to its user", async () => {
    const user = (await login({ sub: "sub-s2", name: "Asha", role: "admin" }))!;
    const { token, expiresAt } = await createSession(db, user.id);
    expect(await sessionUser(db, token)).toMatchObject({ id: user.id, name: "Asha", role: "admin" });
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(SESSION_TTL_MS - 60_000);
  });

  test("unknown, missing, expired and logged-out tokens resolve to null", async () => {
    const user = (await login({ sub: "sub-s3" }))!;
    expect(await sessionUser(db, "not-a-real-token")).toBeNull();
    expect(await sessionUser(db, undefined)).toBeNull();

    const old = await createSession(db, user.id, { now: new Date(Date.now() - SESSION_TTL_MS - 1000) });
    expect(await sessionUser(db, old.token)).toBeNull();

    const live = await createSession(db, user.id);
    await deleteSession(db, live.token);
    expect(await sessionUser(db, live.token)).toBeNull();
    await deleteSession(db, undefined); // no-op
  });

  test("deactivated users lose access immediately", async () => {
    const user = (await login({ sub: "sub-s4" }))!;
    const { token } = await createSession(db, user.id);
    await db`update users set active = false where id = ${user.id}`;
    expect(await sessionUser(db, token)).toBeNull();
  });
});
