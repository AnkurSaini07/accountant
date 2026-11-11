import { describe, expect, test } from "bun:test";
import { createApp } from "../app.ts";
import { testDb } from "../test/db.ts";
import type { Oidc } from "./oidc.ts";

const db = await testDb();
const oidc = {} as Oidc; // not reached
const login = (env: Record<string, string>, body: unknown) =>
  createApp({ db, oidc, env }).request("/api/test/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/test/login", () => {
  for (const NODE_ENV of ["production", "development", ""]) {
    test(`is a 404 when NODE_ENV=${NODE_ENV || "(unset)"}`, async () => {
      const res = await login({ NODE_ENV }, { role: "admin" });
      expect(res.status).toBe(404);
      expect(res.headers.get("set-cookie")).toBeNull();
    });
  }

  test("NODE_ENV=test: signs in with the role, and the session works", async () => {
    const res = await login({ NODE_ENV: "test" }, { role: "operator" });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^session=[^;]+;.*HttpOnly/);
    const me = await createApp({ db, oidc, env: { NODE_ENV: "test" } }).request("/api/auth/me", {
      headers: { cookie: cookie.split(";")[0]! },
    });
    expect(await me.json()).toMatchObject({ name: "E2E operator", role: "operator" });
  });

  test("rejects unknown roles", async () => {
    const res = await login({ NODE_ENV: "test" }, { role: "owner" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION");
  });
});
