// /api/auth/*: login (→ Pocket ID), callback, me, logout.
import type { SQL } from "bun";
import { Hono } from "hono";
import { deleteCookie, getCookie, getSignedCookie, setCookie, setSignedCookie } from "hono/cookie";
import { AppError } from "../errors.ts";
import type { Oidc, PendingLogin } from "./oidc.ts";
import { roleFromGroups } from "./oidc.ts";
import { createSession, deleteSession, sessionUser } from "./sessions.ts";
import upsertUser from "./upsert_user.sql";

export const SESSION_COOKIE = "session";
const LOGIN_COOKIE = "oidc_login";
const prod = () => process.env.NODE_ENV === "production";

/** Signs the short-lived login cookie. Must be long and random; never reuse another secret. */
export function cookieSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.COOKIE_SECRET?.trim() ?? "";
  if (secret.length < 32) throw new Error("COOKIE_SECRET must be at least 32 characters (see .env.example).");
  return secret;
}

/** Only same-site paths, so the login can't be turned into an open redirect ("//evil.com", "/\\evil.com"). */
export function safeReturnTo(value: string | undefined): string {
  return value && /^\/(?![/\\])/.test(value) ? value : "/";
}

const loginFailed = (message: string) => new AppError(400, "LOGIN_FAILED", message);

export function authRoutes({ db, oidc, secret = cookieSecret }: { db: SQL; oidc: Oidc; secret?: () => string }) {
  return new Hono()
    .get("/login", async (c) => {
      const { url, pending } = await oidc.start(safeReturnTo(c.req.query("returnTo")));
      await setSignedCookie(c, LOGIN_COOKIE, JSON.stringify(pending), secret(), {
        path: "/api/auth",
        httpOnly: true,
        sameSite: "Lax", // must survive the top-level redirect back from Pocket ID
        secure: prod(),
        maxAge: 10 * 60,
      });
      return c.redirect(url.href);
    })

    .get("/callback", async (c) => {
      const raw = await getSignedCookie(c, secret(), LOGIN_COOKIE);
      deleteCookie(c, LOGIN_COOKIE, { path: "/api/auth" });
      if (!raw) throw loginFailed("Your sign-in expired or was started in another browser. Please sign in again.");

      let user;
      const pending = JSON.parse(raw) as PendingLogin;
      try {
        user = await oidc.finish(new URL(c.req.url), pending);
      } catch (err) {
        console.error("OIDC callback rejected:", err);
        throw loginFailed("Sign-in could not be verified. Please try again.");
      }

      const role = roleFromGroups(user.groups);
      if (!role) return c.redirect("/no-access"); // signed in to Pocket ID, but not in an accountant-* group

      const row = await upsertUser.run(db, { sub: user.sub, email: user.email, name: user.name, role });
      if (!row?.active) return c.redirect("/no-access"); // deactivated in this app
      const { token, expiresAt } = await createSession(db, row.id, { idToken: user.idToken });
      setCookie(c, SESSION_COOKIE, token, { path: "/", httpOnly: true, sameSite: "Lax", secure: prod(), expires: expiresAt });
      return c.redirect(pending.returnTo);
    })

    .get("/me", async (c) => {
      const user = await sessionUser(db, getCookie(c, SESSION_COOKIE));
      if (!user) throw new AppError(401, "UNAUTHORIZED", "You are not signed in.");
      return c.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    })

    .post("/logout", async (c) => {
      const idToken = await deleteSession(db, getCookie(c, SESSION_COOKIE));
      deleteCookie(c, SESSION_COOKIE, { path: "/" });
      // The browser goes here next, so Pocket ID forgets the user too.
      return c.json({ endSessionUrl: await oidc.endSessionUrl(idToken) });
    });
}
