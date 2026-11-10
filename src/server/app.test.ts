import { describe, expect, test } from "bun:test";
import { app } from "./app.ts";

describe("api", () => {
  test("GET /api/health returns ok", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("unknown API route returns a JSON 404", async () => {
    const res = await app.request("/api/nope", { method: "POST" });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "No route for POST /api/nope" } });
  });
});
