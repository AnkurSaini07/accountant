// Who is calling: requireSession loads the signed-in user (401 otherwise); requireRole limits a route
// to the listed roles (403 otherwise). Roles are listed explicitly per route rather than ranked,
// because access isn't a ladder (e.g. operators make challans, but never see payroll).
import type { SQL } from "bun";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { AppError, ForbiddenError } from "../errors.ts";
import type { Role } from "./oidc.ts";
import { SESSION_COOKIE } from "./routes.ts";
import { sessionUser } from "./sessions.ts";

export type CurrentUser = { id: number; name: string; email: string | null; role: Role };
export type AuthEnv = { Variables: { user: CurrentUser } };

export const requireSession = (db: SQL) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const row = await sessionUser(db, getCookie(c, SESSION_COOKIE));
    if (!row) throw new AppError(401, "UNAUTHORIZED", "You are not signed in.");
    c.set("user", { id: row.id, name: row.name, email: row.email, role: row.role });
    await next();
  });

/** Use after requireSession: `app.get("/payroll", requireRole("admin", "accountant"), …)`. */
export const requireRole = (...roles: [Role, ...Role[]]) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    if (!roles.includes(c.get("user").role)) throw new ForbiddenError();
    await next();
  });
