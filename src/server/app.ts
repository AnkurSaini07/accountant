import type { SQL } from "bun";
import { Hono } from "hono";
import { type AuthEnv, requireSession } from "./auth/middleware.ts";
import { createOidc, type Oidc } from "./auth/oidc.ts";
import { authRoutes } from "./auth/routes.ts";
import { testLoginRoutes } from "./auth/test-login.ts";
import { companyRoutes } from "./company/routes.ts";
import { db as defaultDb } from "./db.ts";
import { onError, onNotFound } from "./errors.ts";

// Reachable without signing in. Everything else under /api needs a session.
// /api/test/* only exists when NODE_ENV=test; otherwise it is a plain 404.
const PUBLIC = /^\/api\/(health$|auth\/|test\/)/;

/** The API. A factory so tests can run the real app against their own database. */
export function createApp({
  db = defaultDb,
  oidc = createOidc(),
  env = process.env,
}: { db?: SQL; oidc?: Oidc; env?: Record<string, string | undefined> } = {}) {
  const sessionRequired = requireSession(db);
  const app = new Hono<AuthEnv>().basePath("/api");

  app.use((c, next) => (PUBLIC.test(c.req.path) ? next() : sessionRequired(c, next)));

  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/auth", authRoutes({ db, oidc }));
  app.route("/company", companyRoutes(db));
  if (env.NODE_ENV === "test") app.route("/test", testLoginRoutes(db));

  app.notFound(onNotFound);
  app.onError(onError);
  return app;
}

// The app Bun.serve() runs (src/server/index.ts).
export const app = createApp();
