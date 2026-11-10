import { Hono } from "hono";

// The Hono app, kept separate from Bun.serve() so tests can call app.request() directly.
export const app = new Hono().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: `No route for ${c.req.method} ${c.req.path}` } }, 404));
