import { describe, expect, test } from "bun:test";
import { app } from "./app.ts";

describe("api", () => {
  test("GET /api/health returns ok", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  // Signed-in 404s are tested in auth/middleware.test.ts.
  test("without a session, even unknown routes answer 401 (no route discovery)", async () => {
    const res = await app.request("/api/nope", { method: "POST" });
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "You are not signed in." } });
  });
});
