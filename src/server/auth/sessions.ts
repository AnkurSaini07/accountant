// Session tokens: 256 random bits, base64url in an HttpOnly cookie; the DB keeps only SHA-256(token).
import type { SQL } from "bun";
import createSessionQuery from "./create_session.sql";
import deleteSessionQuery from "./delete_session.sql";
import getSessionQuery from "./get_session.sql";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // a working week; signing in again is one click
// ponytail: expired rows are only filtered out, never deleted. Add a periodic
// `delete from sessions where expires_at < now()` if the table ever grows noticeably.

const hash = (token: string) => new Bun.CryptoHasher("sha256").update(token).digest("hex");

/** Starts a session for `userId`. Returns the token for the cookie. `idToken` is kept for logout. */
export async function createSession(db: SQL, userId: number, { now = new Date(), idToken = null as string | null } = {}) {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await createSessionQuery.run(db, { token_hash: hash(token), user_id: userId, expires_at: expiresAt.toISOString(), id_token: idToken });
  return { token, expiresAt };
}

/** The user behind a session token, or null when the token is unknown, expired or the user inactive. */
export async function sessionUser(db: SQL, token: string | undefined) {
  if (!token) return null;
  return getSessionQuery.run(db, { token_hash: hash(token) });
}

/** Ends a session (logout). Returns its ID token (for Pocket ID's logout), or null. Unknown tokens are ignored. */
export async function deleteSession(db: SQL, token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const row = await deleteSessionQuery.run(db, { token_hash: hash(token) });
  return row?.id_token ?? null;
}
