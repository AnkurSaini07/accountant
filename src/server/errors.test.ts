import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { Hono } from "hono";
import { z } from "zod";
import { ConflictError, type ErrorBody, ForbiddenError, NotFoundError, onError, onNotFound, validate } from "./errors.ts";

const Party = z.object({
  name: z.string().trim().min(1, "Name is required"),
  gstin: z.string().length(15).optional(),
  lines: z.array(z.object({ qty: z.number().positive() })).default([]),
});

const app = new Hono()
  .post("/parties", validate("json", Party), (c) => c.json(c.req.valid("json"), 201))
  .get("/items", validate("query", z.object({ page: z.coerce.number().int().min(1) })), (c) => c.json(c.req.valid("query")))
  .get("/forbidden", () => { throw new ForbiddenError(); })
  .get("/missing", () => { throw new NotFoundError("Invoice 42 not found"); })
  .get("/conflict", () => { throw new ConflictError("Invoice number INV-1 already exists", { number: "INV-1" }); })
  .get("/boom", () => { throw new Error("connection to 10.0.0.5 refused at /srv/app/db.ts:12"); })
  .notFound(onNotFound)
  .onError(onError);

const post = (json: unknown) => app.request("/parties", { method: "POST", body: JSON.stringify(json), headers: { "content-type": "application/json" } });
const errorOf = async (res: Response) => ((await res.json()) as ErrorBody).error;

describe("validate", () => {
  test("passes the parsed, typed value to the handler", async () => {
    const res = await post({ name: "  Sharma Steels ", lines: [{ qty: 2 }] });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ name: "Sharma Steels", lines: [{ qty: 2 }] });
  });

  test("invalid body → 400 with a message per field, nested paths dotted", async () => {
    const res = await post({ name: "", gstin: "123", lines: [{ qty: 1 }, { qty: -1 }] });
    expect(res.status).toBe(400);
    const error = await errorOf(res);
    expect(error.code).toBe("VALIDATION");
    expect(error.details).toEqual({
      fields: {
        name: ["Name is required"],
        gstin: [expect.stringContaining("15")],
        "lines.1.qty": [expect.stringContaining("0")],
      },
    });
  });

  test("query strings are validated too", async () => {
    expect(await (await app.request("/items?page=2")).json()).toEqual({ page: 2 });
    const res = await app.request("/items?page=0");
    expect(res.status).toBe(400);
    expect(Object.keys((await errorOf(res)).details as object)).toEqual(["fields"]);
  });

  test("malformed JSON → 400 BAD_REQUEST, not a 500", async () => {
    const res = await app.request("/parties", { method: "POST", body: "{nope", headers: { "content-type": "application/json" } });
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("BAD_REQUEST");
  });
});

describe("error types", () => {
  test.each([
    ["/forbidden", 403, { code: "FORBIDDEN", message: "You don't have permission to do this." }],
    ["/missing", 404, { code: "NOT_FOUND", message: "Invoice 42 not found" }],
    ["/conflict", 409, { code: "CONFLICT", message: "Invoice number INV-1 already exists", details: { number: "INV-1" } }],
    ["/no-such-route", 404, { code: "NOT_FOUND", message: "No route for GET /no-such-route" }],
  ] as const)("%s → %d", async (path, status, error) => {
    const res = await app.request(path);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });
});

describe("unknown errors", () => {
  const env = process.env.NODE_ENV;
  const log = spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => {
    process.env.NODE_ENV = env;
    log.mockClear();
  });

  test("500 with a generic message and nothing internal in production", async () => {
    process.env.NODE_ENV = "production";
    const res = await app.request("/boom");
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } });
    expect(text).not.toMatch(/10\.0\.0\.5|db\.ts|at /);
    expect(log).toHaveBeenCalledTimes(1); // still logged server-side
  });

  test("development responses include the cause, to speed up debugging", async () => {
    process.env.NODE_ENV = "development";
    const error = await errorOf(await app.request("/boom"));
    expect(error.details).toEqual({ cause: expect.stringContaining("connection to 10.0.0.5 refused") });
  });
});
