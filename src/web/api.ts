// Typed fetch wrapper for our own API: `const party = await api.get<Party>("/parties/42")`.
// Failures throw ApiError carrying the server's { error: { code, message, details } }.
// Most failures also show a toast; two don't, because the UI handles them in place:
// VALIDATION (forms show field errors) and 401 (the app sends the user to sign in).
import { ToastQueue } from "@react-spectrum/s2/Toast";

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

  /** For forms: { "lines.0.qty": ["…"] } on VALIDATION errors, otherwise {}. */
  get fieldErrors(): Record<string, string[]> {
    const fields = (this.details as { fields?: Record<string, string[]> } | undefined)?.fields;
    return this.code === "VALIDATION" && fields ? fields : {};
  }
}

const silent = (e: ApiError) => e.status === 401 || e.code === "VALIDATION";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin", // send the session cookie
      headers: body === undefined ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw fail(new ApiError(0, "NETWORK", "Can't reach the server. Check your connection and try again."));
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined; // e.g. an HTML error page from a proxy
  }
  if (res.ok) return json as T;

  const error = (json as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
  throw fail(
    new ApiError(
      res.status,
      error?.code ?? `HTTP_${res.status}`,
      error?.message ?? `The server answered ${res.status}. Please try again.`,
      error?.details,
    ),
  );
}

function fail(e: ApiError): ApiError {
  if (!silent(e)) ToastQueue.negative(e.message, { timeout: 8000 });
  return e;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};
