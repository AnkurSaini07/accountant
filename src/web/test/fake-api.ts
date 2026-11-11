// Fake /api for component tests: fakeApi({ "GET /auth/me": user, "POST /auth/logout": {...} }).
// A handler value is the JSON body (200), a Response, or a function returning either.
// Unlisted routes answer 404. Restored automatically after each test (registered in setup.ts).
type Handler = unknown | Response | ((req: Request) => unknown | Response);

const realFetch = globalThis.fetch;
export const calls: string[] = [];

export function fakeApi(routes: Record<string, Handler>) {
  calls.length = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(new URL(String(input instanceof Request ? input.url : input), "http://localhost:3000"), init);
    const key = `${req.method} ${new URL(req.url).pathname.replace(/^\/api/, "")}`;
    calls.push(key);
    if (!(key in routes)) return Response.json({ error: { code: "NOT_FOUND", message: `No fake for ${key}` } }, { status: 404 });
    const handler = routes[key];
    const result = typeof handler === "function" ? await (handler as (r: Request) => unknown)(req) : handler;
    return result instanceof Response ? result : Response.json(result);
  }) as typeof fetch;
}

/** The signed-in user most tests use (an admin). */
export const ME = { id: 1, name: "Asha Verma", email: "asha@example.com", role: "admin" as const };

/** A company as GET /api/company returns it. */
export const COMPANY = {
  id: 1,
  legal_name: "Saini Engineering Works",
  trade_name: null as string | null,
  state_code: "06",
  gstin: null as string | null,
  pan: null as string | null,
  phone: null as string | null,
  email: null as string | null,
  logo: null as string | null,
  signature: null as string | null,
  terms: "",
  addresses: [{ id: 1, label: "Registered office", address: "Plot 12, Sector 24", city: "Faridabad", pincode: "121005" as string | null, is_primary: true }],
  bank_accounts: [] as { id?: number; bank_name: string; account_name: string | null; account_number: string; ifsc: string; branch: string | null; is_default: boolean }[],
};

export const unauthorized = () => Response.json({ error: { code: "UNAUTHORIZED", message: "You are not signed in." } }, { status: 401 });

export function restoreFetch() {
  globalThis.fetch = realFetch;
}
