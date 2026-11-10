import { Hono } from "hono";
import { onError, onNotFound } from "./errors.ts";

// The Hono app, kept separate from Bun.serve() so tests can call app.request() directly.
export const app = new Hono().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));

app.notFound(onNotFound);
app.onError(onError);
