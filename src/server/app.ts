import { Hono } from "hono";
import { authRoutes } from "./auth/routes.ts";
import { createOidc } from "./auth/oidc.ts";
import { db } from "./db.ts";
import { onError, onNotFound } from "./errors.ts";

// The Hono app, kept separate from Bun.serve() so tests can call app.request() directly.
export const app = new Hono().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes({ db, oidc: createOidc() }));

app.notFound(onNotFound);
app.onError(onError);
