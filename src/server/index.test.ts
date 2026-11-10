import { afterAll, beforeAll, describe, expect, test } from "bun:test";

let server: Bun.Server<undefined>;

beforeAll(async () => {
  process.env.PORT = "0"; // random free port
  ({ server } = await import("./index.ts"));
});

afterAll(() => server.stop(true));

describe("server routing", () => {
  test.each(["/", "/sales/invoices/42"])("%s serves the React app", async (path) => {
    const res = await fetch(new URL(path, server.url));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain('<div id="root">');
  });

  test("/api/* is still handled by Hono", async () => {
    const res = await fetch(new URL("/api/health", server.url));
    expect(await res.json()).toEqual({ ok: true });
  });
});
