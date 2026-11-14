import { ToastQueue } from "./toast.ts";
import { afterAll, afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { ApiError, call, client } from "./api.ts";

const realFetch = globalThis.fetch;
const toast = spyOn(ToastQueue, "negative").mockImplementation(() => () => {});
afterEach(() => {
  globalThis.fetch = realFetch;
  toast.mockClear();
});
// Test files share one process: leave the real ToastQueue for later files (App.test.tsx renders toasts).
afterAll(() => toast.mockRestore());

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
    expect(await call(client.api.parties[":id"].$get({ param: { id: "42" } }))).toMatchObject({ id: 42, name: "Sharma Steels" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toEndWith("/api/parties/42");
    expect(init).toMatchObject({ method: "GET", credentials: "same-origin" });
    expect(toast).not.toHaveBeenCalled();
  });

  test("query strings and JSON bodies are sent as the route declares", async () => {
    let fetchMock = respond(200, { fy: 2026, series: [] });
    await call(client.api.series.$get({ query: { fy: "2026" } }));
    expect(String(fetchMock.mock.calls[0]![0])).toEndWith("/api/series?fy=2026");

    fetchMock = respond(200, { fy: 2026, series: [] });
    await call(client.api.series.$put({ json: { fy: 2026, series: [] } }));
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init).toMatchObject({ method: "PUT", body: '{"fy":2026,"series":[]}' });
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });
});

describe("failures", () => {
  test("400 with field errors: ApiError with fieldErrors, no toast (the form shows them)", async () => {
    respond(400, { error: { code: "VALIDATION", message: "Some fields are invalid.", details: { fields: { "lines.0.qty": ["Too small"] } } } });
    const e = await caught(call(client.api.auth.logout.$post()));
    expect(e).toBeInstanceOf(ApiError);
    expect([e.status, e.code, e.message]).toEqual([400, "VALIDATION", "Some fields are invalid."]);
    expect(e.fieldErrors).toEqual({ "lines.0.qty": ["Too small"] });
    expect(toast).not.toHaveBeenCalled();
  });

  test("401: ApiError, no toast (the app redirects to sign-in)", async () => {
    respond(401, { error: { code: "UNAUTHORIZED", message: "You are not signed in." } });
    const e = await caught(call(client.api.company.$get()));
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
      const e = await caught(call(client.api.company.$get()));
      expect([e.status, e.code, e.message, e.fieldErrors]).toEqual([status, code, message, {}]);
      expect(toast).toHaveBeenCalledWith(message, { timeout: 8000 });
    }
  });

  test("a non-JSON error page still gives a readable error", async () => {
    respond(502, undefined, "<html>Bad Gateway</html>");
    const e = await caught(call(client.api.company.$get()));
    expect([e.status, e.code]).toEqual([502, "HTTP_502"]);
    expect(e.message).toMatch(/502/);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  test("network failure: status 0, NETWORK, toast", async () => {
    globalThis.fetch = (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    const e = await caught(call(client.api.company.$get()));
    expect([e.status, e.code]).toEqual([0, "NETWORK"]);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("Can't reach the server"), { timeout: 8000 });
  });
});
