import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createApp } from "../app.ts";
import { onError } from "../errors.ts";
import { testDb } from "../test/db.ts";
import { type AuthEnv, requireRole, requireSession } from "./middleware.ts";
import { type Oidc, ROLES, type Role } from "./oidc.ts";
import { createSession } from "./sessions.ts";
import upsertUser from "./upsert_user.sql";

const db = await testDb();

/** A signed-in user with `role`; returns the Cookie header. */
async function cookieFor(role: Role, sub = `sub-${role}`) {
  const user = (await upsertUser.run(db, { sub, email: null, name: `${role} user`, role }))!;
  return `session=${(await createSession(db, user.id)).token}`;
}
const cookies = Object.fromEntries(await Promise.all(ROLES.map(async (r) => [r, await cookieFor(r)] as const))) as Record<Role, string>;

// Routes as features will declare them.
const api = new Hono<AuthEnv>()
  .use(requireSession(db))
  .get("/whoami", (c) => c.json(c.get("user")))
  .get("/settings", requireRole("admin"), (c) => c.text("settings"))
  .get("/payroll", requireRole("admin", "accountant"), (c) => c.text("payroll"))
  .post("/challans", requireRole("admin", "accountant", "operator"), (c) => c.text("created"))
  .onError(onError);

const get = (path: string, cookie?: string, method = "GET") => api.request(path, { method, headers: cookie ? { cookie } : {} });

describe("requireSession", () => {
  test("401 without a session or with a bad one", async () => {
    for (const cookie of [undefined, "session=", "session=forged-token"]) {
      const res = await get("/whoami", cookie);
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    }
  });

  test("puts the signed-in user on the context", async () => {
    expect(await (await get("/whoami", cookies.operator)).json()).toEqual({
      id: expect.any(Number), name: "operator user", email: null, role: "operator",
    });
  });

  test("a deactivated user is signed out immediately", async () => {
    const cookie = await cookieFor("accountant", "sub-leaver");
    expect((await get("/whoami", cookie)).status).toBe(200);
    await db`update users set active = false where oidc_sub = 'sub-leaver'`;
    expect((await get("/whoami", cookie)).status).toBe(401);
  });
});

describe("requireRole, per role", () => {
  // route → roles allowed
  const matrix: [string, string, Role[]][] = [
    ["GET", "/settings", ["admin"]],
    ["GET", "/payroll", ["admin", "accountant"]],
    ["POST", "/challans", ["admin", "accountant", "operator"]],
  ];
  for (const [method, path, allowed] of matrix) {
    for (const role of ROLES) {
      const ok = allowed.includes(role);
      test(`${role} ${ok ? "can" : "cannot"} ${method} ${path}`, async () => {
        const res = await get(path, cookies[role], method);
        expect(res.status).toBe(ok ? 200 : 403);
        if (!ok) expect((await res.json()).error.code).toBe("FORBIDDEN");
      });
    }
  }

  test("still 401 (not 403) when not signed in", async () => {
    expect((await get("/settings")).status).toBe(401);
  });
});

describe("the real app", () => {
  // No real Pocket ID here: logout only needs the end-session URL.
  const oidc = { endSessionUrl: async () => null } as unknown as Oidc;
  const app = createApp({ db, oidc });

  test("health and sign-in routes are public", async () => {
    expect((await app.request("/api/health")).status).toBe(200);
    expect((await app.request("/api/auth/me")).status).toBe(401); // reached the route: it answers for itself
    expect((await app.request("/api/auth/logout", { method: "POST" })).status).toBe(200);
  });

  test("everything else needs a session, including unknown routes", async () => {
    for (const path of ["/api/parties", "/api/nope", "/api/healthz", "/api/health/x", "/api/authx"]) {
      expect((await app.request(path)).status).toBe(401);
    }
  });

  test("signed in, unknown routes are a JSON 404", async () => {
    const res = await app.request("/api/nope", { method: "POST", headers: { cookie: cookies.viewer } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "No route for POST /api/nope" } });
  });
});
