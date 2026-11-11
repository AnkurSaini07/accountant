// The typed API client (Hono RPC): `const company = await call(client.api.company.$get())`.
// Paths, inputs and response bodies come from the server's routes (AppType), so a route change
// that breaks the UI fails the type check instead of the browser.
// Failures throw ApiError carrying the server's { error: { code, message, details } }. Most also
// show a toast; errors with field details don't (the form shows them next to the fields), and
// neither does 401 (the app sends the user to sign in).
import { ToastQueue } from "@react-spectrum/s2/Toast";
import { type ClientResponse, hc } from "hono/client";
import type { AppType } from "../server/app.ts";

export class ApiError extends Error {
  constructor(
    readonly status: number, // 0 = no response (network down, server unreachable)
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** For forms: { "lines.0.qty": ["…"] } when the server named fields (400, 409), otherwise {}. */
  get fieldErrors(): Record<string, string[]> {
    return (this.details as { fields?: Record<string, string[]> } | undefined)?.fields ?? {};
  }
}

let onUnauthorized: (() => void) | undefined;
/** Called on every 401, e.g. when a session expires mid-work. auth.tsx uses it to send the user to sign in. */
export function setUnauthorizedHandler(fn: (() => void) | undefined) {
  onUnauthorized = fn;
}

function fail(e: ApiError): ApiError {
  if (e.status === 401) onUnauthorized?.();
  else if (!Object.keys(e.fieldErrors).length) ToastQueue.negative(e.message, { timeout: 8000 });
  return e;
}

/** fetch for the client: sends the session cookie, and turns every failure into an ApiError. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, { ...init, credentials: "same-origin" });
  } catch {
    throw fail(new ApiError(0, "NETWORK", "Can't reach the server. Check your connection and try again."));
  }
  if (res.ok) return res;

  let error: { code?: string; message?: string; details?: unknown } | undefined;
  try {
    error = ((await res.json()) as { error?: typeof error }).error;
  } catch {
    error = undefined; // e.g. an HTML error page from a proxy
  }
  throw fail(new ApiError(res.status, error?.code ?? `HTTP_${res.status}`, error?.message ?? `The server answered ${res.status}. Please try again.`, error?.details));
}

export const client = hc<AppType>("/", { fetch: apiFetch });

/** Awaits a client call and returns its typed JSON body (failures have already thrown ApiError). */
export async function call<T>(request: Promise<ClientResponse<T>>): Promise<T> {
  return (await request).json() as Promise<T>;
}
