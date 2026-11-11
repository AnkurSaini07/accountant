import { ToastQueue } from "@react-spectrum/s2/Toast";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { ApiError, api } from "./api.ts";

const realFetch = globalThis.fetch;
const toast = spyOn(ToastQueue, "negative").mockImplementation(() => () => {});
afterEach(() => {
  globalThis.fetch = realFetch;
  toast.mockClear();
});

/** Replaces fetch; returns the mock so tests can inspect the request. */
function respond(status: number, body?: unknown, raw?: string) {
  const fn = mock(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(raw ?? (body === undefined ? null : JSON.stringify(body)), { status, headers: { "content-type": "application/json" } }),
  );
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}
async function caught(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error("expected a rejection");
}

describe("success", () => {
  test("GET returns parsed JSON and sends the session cookie", async () => {
    const fetchMock = respond(200, { id: 42, name: "Sharma Steels" });
    expect(await api.get<{ id: number; name: string }>("/parties/42")).toEqual({ id: 42, name: "Sharma Steels" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/parties/42");
    expect(init).toMatchObject({ method: "GET", credentials: "same-origin", body: undefined });
    expect(toast).not.toHaveBeenCalled();
  });

  test("POST/PUT send JSON bodies; empty responses resolve to undefined", async () => {
    const fetchMock = respond(201, { id: 7 });
    await api.post("/parties", { name: "A" });
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "POST", body: '{"name":"A"}', headers: { "content-type": "application/json" } });

    respond(204);
    expect(await api.delete("/parties/7")).toBeUndefined();
    respond(200, { ok: true });
    expect(await api.put("/parties/7", { name: "B" })).toEqual({ ok: true });
  });
});

describe("failures", () => {
  test("400 with field errors: ApiError with fieldErrors, no toast (the form shows them)", async () => {
    respond(400, { error: { code: "VALIDATION", message: "Some fields are invalid.", details: { fields: { "lines.0.qty": ["Too small"] } } } });
    const e = await caught(api.post("/invoices", {}));
    expect(e).toBeInstanceOf(ApiError);
    expect([e.status, e.code, e.message]).toEqual([400, "VALIDATION", "Some fields are invalid."]);
    expect(e.fieldErrors).toEqual({ "lines.0.qty": ["Too small"] });
    expect(toast).not.toHaveBeenCalled();
  });

  test("401: ApiError, no toast (the app redirects to sign-in)", async () => {
    respond(401, { error: { code: "UNAUTHORIZED", message: "You are not signed in." } });
    const e = await caught(api.get("/parties"));
    expect([e.status, e.code]).toEqual([401, "UNAUTHORIZED"]);
    expect(toast).not.toHaveBeenCalled();
  });

  test("403/404/409/500 toast the server's message", async () => {
    for (const [status, code, message] of [
      [403, "FORBIDDEN", "You don't have permission to do this."],
      [404, "NOT_FOUND", "Invoice 42 not found"],
      [409, "CONFLICT", "Invoice number INV-1 already exists"],
      [500, "INTERNAL", "Something went wrong. Please try again."],
    ] as const) {
      toast.mockClear();
      respond(status, { error: { code, message } });
      const e = await caught(api.get("/x"));
      expect([e.status, e.code, e.message, e.fieldErrors]).toEqual([status, code, message, {}]);
      expect(toast).toHaveBeenCalledWith(message, { timeout: 8000 });
    }
  });

  test("a non-JSON error page still gives a readable error", async () => {
    respond(502, undefined, "<html>Bad Gateway</html>");
    const e = await caught(api.get("/x"));
    expect([e.status, e.code]).toEqual([502, "HTTP_502"]);
    expect(e.message).toMatch(/502/);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  test("network failure: status 0, NETWORK, toast", async () => {
    globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    const e = await caught(api.get("/x"));
    expect([e.status, e.code]).toEqual([0, "NETWORK"]);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("Can't reach the server"), { timeout: 8000 });
  });
});
