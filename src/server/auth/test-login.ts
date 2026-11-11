// POST /api/test/login { role }: signs the browser in as a fixed user with that role, for Playwright
// (passkeys can't be automated). createApp() mounts it only when NODE_ENV=test; elsewhere it's a 404.
import type { SQL } from "bun";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { validate } from "../errors.ts";
import { ROLES } from "./oidc.ts";
import { SESSION_COOKIE } from "./routes.ts";
import { createSession } from "./sessions.ts";
import upsertUser from "./upsert_user.sql";

export function testLoginRoutes(db: SQL) {
  return new Hono().post("/login", validate("json", z.object({ role: z.enum(ROLES) })), async (c) => {
    const { role } = c.req.valid("json");
    const user = (await upsertUser.run(db, { sub: `e2e-${role}`, email: `${role}@e2e.test`, name: `E2E ${role}`, role }))!;
    const { token, expiresAt } = await createSession(db, user.id);
    setCookie(c, SESSION_COOKIE, token, { path: "/", httpOnly: true, sameSite: "Lax", expires: expiresAt });
    return c.json({ id: user.id, role });
  });
}
