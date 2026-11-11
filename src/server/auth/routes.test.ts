// Login flow against a fake OIDC provider (discovery + token endpoint, RS256-signed ID tokens)
// and an isolated database. The browser is simulated by following redirects and carrying cookies.
import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { Hono } from "hono";
import { onError } from "../errors.ts";
import { testDb } from "../test/db.ts";
import { cookieSecret, authRoutes, safeReturnTo } from "./routes.ts";
import { createOidc, oidcConfig, roleFromGroups } from "./oidc.ts";

const db = await testDb();
const CLIENT_ID = "accountant-app";
const CLIENT_SECRET = "client-secret";

// ---- fake provider -------------------------------------------------------------------------
const keys = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const b64url = (data: ArrayBuffer | string) => (typeof data === "string" ? Buffer.from(data) : Buffer.from(new Uint8Array(data))).toString("base64url");
async function signJwt(claims: Record<string, unknown>) {
  const input = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "k1" }))}.${b64url(JSON.stringify(claims))}`;
  return `${input}.${b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(input)))}`;
}

/** What the next token response contains; tests change it to simulate users and attacks. */
let next: { sub: string; name?: string; email?: string; groups?: unknown; nonce?: string } = { sub: "u1" };
let authorized: URLSearchParams; // the authorize request, as Pocket ID would have received it

const provider = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const iss = url.origin;
    if (url.pathname === "/.well-known/openid-configuration") {
      return Response.json({
        issuer: iss,
        authorization_endpoint: `${iss}/authorize`,
        token_endpoint: `${iss}/token`,
        jwks_uri: `${iss}/jwks`,
        end_session_endpoint: `${iss}/end-session`,
        id_token_signing_alg_values_supported: ["RS256"],
      });
    }
    if (url.pathname === "/token" && req.method === "POST") {
      const body = new URLSearchParams(await req.text());
      const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.get("code_verifier") ?? "")));
      if (body.get("client_secret") !== CLIENT_SECRET || body.get("code") !== "good-code" || challenge !== authorized.get("code_challenge")) {
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      }
      const now = Math.floor(Date.now() / 1000);
      const { nonce = authorized.get("nonce"), ...claims } = next;
      const id_token = await signJwt({ iss, aud: CLIENT_ID, iat: now, exp: now + 300, nonce, ...claims });
      return Response.json({ access_token: "at", token_type: "Bearer", id_token });
    }
    return new Response("not found", { status: 404 });
  },
});
afterAll(() => provider.stop(true));

// ---- app under test --------------------------------------------------------------------------
const cfg = { issuer: new URL(provider.url.origin), clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, appUrl: new URL("http://localhost:3000") };
const app = new Hono()
  .basePath("/api")
  .route("/auth", authRoutes({ db, oidc: createOidc(() => cfg), secret: () => "s".repeat(32) }))
  .onError(onError);

const cookiesOf = (res: Response) => Object.fromEntries(res.headers.getSetCookie().map((c) => c.split(";")[0]!.split("=") as [string, string]));
const header = (cookies: Record<string, string>) => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");

/** Starts a login; returns what the browser holds when Pocket ID sends it back. */
async function startLogin(returnTo = "/sales/invoices/42") {
  const res = await app.request(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  expect(res.status).toBe(302);
  const location = new URL(res.headers.get("location")!);
  authorized = location.searchParams;
  return { res, location, cookies: cookiesOf(res) };
}

/** Pocket ID → our callback, with the code and (by default) the right state. */
async function callback(cookies: Record<string, string>, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ code: "good-code", state: authorized.get("state")!, ...params });
  return app.request(`/api/auth/callback?${qs}`, { headers: { cookie: header(cookies) } });
}

async function signIn(user: typeof next, returnTo?: string) {
  next = user;
  const { cookies } = await startLogin(returnTo);
  return callback(cookies);
}

const log = spyOn(console, "error").mockImplementation(() => {});
afterEach(() => log.mockClear());

describe("login", () => {
  test("redirects to the provider with PKCE (S256), state, nonce and the right scopes", async () => {
    const { location, res } = await startLogin();
    expect(location.origin + location.pathname).toBe(`${provider.url.origin}/authorize`);
    expect(Object.fromEntries(authorized)).toMatchObject({
      client_id: CLIENT_ID,
      redirect_uri: "http://localhost:3000/api/auth/callback",
      response_type: "code",
      scope: "openid profile email groups",
      code_challenge_method: "S256",
    });
    expect(authorized.get("code_challenge")).toMatch(/^[\w-]{43}$/);
    expect(authorized.get("state")).toBeTruthy();
    expect(authorized.get("nonce")).toBeTruthy();
    const cookie = res.headers.getSetCookie()[0]!;
    expect(cookie).toMatch(/^oidc_login=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/Max-Age=600/);
  });

  test("a full round-trip signs the user in and returns to the original page", async () => {
    const res = await signIn({ sub: "sub-asha", name: "Asha", email: "asha@example.com", groups: ["staff", "accountant-admin"] });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/sales/invoices/42");

    const session = res.headers.getSetCookie().find((c) => c.startsWith("session="))!;
    expect(session).toMatch(/HttpOnly/);
    expect(session).toMatch(/SameSite=Lax/);
    expect(session).toMatch(/Path=\//);
    expect(session).not.toMatch(/Secure/); // dev/test: plain http
    const me = await app.request("/api/auth/me", { headers: { cookie: header(cookiesOf(res)) } });
    expect(await me.json()).toEqual({ id: expect.any(Number), name: "Asha", email: "asha@example.com", role: "admin" });
  });

  test("users in no accountant-* group are sent to the no-access page without a session", async () => {
    const res = await signIn({ sub: "sub-nobody", name: "Nobody", groups: ["family"] });
    expect(res.headers.get("location")).toBe("/no-access");
    expect(res.headers.getSetCookie().some((c) => c.startsWith("session="))).toBe(false);
    const [row] = await db`select count(*)::int as n from users where oidc_sub = 'sub-nobody'`;
    expect(row.n).toBe(0);
  });

  test("role is refreshed from groups on every login", async () => {
    await signIn({ sub: "sub-ravi", name: "Ravi", groups: ["accountant-operator"] });
    const res = await signIn({ sub: "sub-ravi", name: "Ravi", groups: ["accountant-accountant"] });
    const me = await app.request("/api/auth/me", { headers: { cookie: header(cookiesOf(res)) } });
    expect((await me.json()).role).toBe("accountant");
  });

  test("open redirects are refused", async () => {
    for (const evil of ["//evil.example", "https://evil.example", "/\\evil.example"]) {
      const res = await signIn({ sub: "sub-r", groups: ["accountant-viewer"] }, evil);
      expect(res.headers.get("location")).toBe("/");
    }
  });
});

describe("callback rejects", () => {
  const expectLoginFailed = async (res: Response, message = /could not be verified/) => {
    expect(res.status).toBe(400);
    const { error } = (await res.json()) as { error: { code: string; message: string } };
    expect(error.code).toBe("LOGIN_FAILED");
    expect(error.message).toMatch(message);
    expect(res.headers.getSetCookie().some((c) => c.startsWith("session="))).toBe(false);
  };

  test("a wrong state (CSRF)", async () => {
    const { cookies } = await startLogin();
    await expectLoginFailed(await callback(cookies, { state: "attacker-state" }));
  });

  test("an ID token with the wrong nonce (replay)", async () => {
    next = { sub: "sub-x", groups: ["accountant-admin"], nonce: "some-other-nonce" };
    const { cookies } = await startLogin();
    await expectLoginFailed(await callback(cookies));
  });

  test("a code the provider won't redeem (wrong PKCE verifier / stolen code)", async () => {
    next = { sub: "sub-x", groups: ["accountant-admin"] };
    const { cookies } = await startLogin();
    await expectLoginFailed(await callback(cookies, { code: "stolen-code" }));
  });

  test("an error from the provider (user cancelled)", async () => {
    const { cookies } = await startLogin();
    await expectLoginFailed(await callback(cookies, { error: "access_denied" }));
  });

  test("a missing or tampered login cookie", async () => {
    const { cookies } = await startLogin();
    await expectLoginFailed(await callback({}), /expired/);
    const [value, sig] = decodeURIComponent(cookies.oidc_login!).split(/\.(?=[^.]*$)/);
    const forged = JSON.stringify({ ...JSON.parse(value!), returnTo: "//evil.example" });
    await expectLoginFailed(await callback({ oidc_login: encodeURIComponent(`${forged}.${sig}`) }), /expired/);
  });
});

describe("me and logout", () => {
  test("me without a session is 401", async () => {
    expect((await app.request("/api/auth/me")).status).toBe(401);
    expect((await app.request("/api/auth/me", { headers: { cookie: "session=nope" } })).status).toBe(401);
  });

  test("logout ends the session and returns the provider's end-session URL", async () => {
    const cookies = cookiesOf(await signIn({ sub: "sub-out", groups: ["accountant-viewer"] }));
    const res = await app.request("/api/auth/logout", { method: "POST", headers: { cookie: header(cookies) } });
    const { endSessionUrl } = (await res.json()) as { endSessionUrl: string };
    const url = new URL(endSessionUrl);
    expect(url.origin + url.pathname).toBe(`${provider.url.origin}/end-session`);
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("http://localhost:3000/");
    // The ID token from sign-in, so Pocket ID trusts the redirect back.
    const hint = url.searchParams.get("id_token_hint")!;
    expect(JSON.parse(Buffer.from(hint.split(".")[1]!, "base64url").toString())).toMatchObject({ sub: "sub-out", aud: CLIENT_ID });
    expect(res.headers.getSetCookie().find((c) => c.startsWith("session="))).toMatch(/Max-Age=0/);
    expect((await app.request("/api/auth/me", { headers: { cookie: header(cookies) } })).status).toBe(401);
  });

  test("logout without a session still returns a URL, just without a hint", async () => {
    const { endSessionUrl } = (await (await app.request("/api/auth/logout", { method: "POST" })).json()) as { endSessionUrl: string };
    expect(new URL(endSessionUrl).searchParams.has("id_token_hint")).toBe(false);
  });

  test("cookies are Secure in production", async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const { res } = await startLogin(); // discovery is cached from earlier tests (http is dev-only)
      expect(res.headers.getSetCookie()[0]).toMatch(/Secure/);
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});

describe("helpers", () => {
  test("roleFromGroups picks the most privileged matching group", () => {
    expect(roleFromGroups(["accountant-viewer", "accountant-admin"])).toBe("admin");
    expect(roleFromGroups(["accountant-operator", "accountant-accountant"])).toBe("accountant");
    expect(roleFromGroups(["accountant-viewer"])).toBe("viewer");
    expect(roleFromGroups(["admin", "accountant-root"])).toBeNull();
    expect(roleFromGroups(undefined)).toBeNull();
    expect(roleFromGroups("accountant-admin")).toBeNull();
  });

  test("safeReturnTo keeps same-site paths only", () => {
    expect(safeReturnTo("/sales?x=1#y")).toBe("/sales?x=1#y");
    for (const bad of [undefined, "", "sales", "//evil", "/\\evil", "https://evil", "javascript:alert(1)"]) expect(safeReturnTo(bad)).toBe("/");
  });

  test("config errors say what to set", () => {
    expect(() => oidcConfig({ APP_URL: "http://localhost:3000" })).toThrow(/OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET/);
    expect(() => cookieSecret({ COOKIE_SECRET: "short" })).toThrow(/at least 32/);
    expect(cookieSecret({ COOKIE_SECRET: "x".repeat(32) })).toHaveLength(32);
  });
});
