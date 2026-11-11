// The app's Postgres client. Queries live in .sql files next to the code that uses them and are
// run with Reylo: `import q from "./x.sql"; await q.run(db, params)`. Types come from the dev database.
import { SQL } from "bun";
import ping from "./ping.sql";

/** Reads and validates DATABASE_URL. Throws a message that says how to fix it. */
export function databaseUrl(env: Record<string, string | undefined> = process.env): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env (dev) or set it in the environment (prod).");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL. Expected postgres://user:password@host:5432/database");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`DATABASE_URL must be a postgres:// URL, got ${parsed.protocol}//`);
  }
  return url;
}

/** host:port/database without credentials, safe for logs and error messages. */
export function describeDatabase(url: string): string {
  const u = new URL(url);
  return `${u.hostname}:${u.port || 5432}${u.pathname}`;
}

// Bun.SQL connects lazily, on the first query; creating it here never blocks startup.
export const db = new SQL(databaseUrl());

/** Runs a trivial query. Throws a readable error when Postgres is unreachable or rejects us. */
export async function checkDatabase(client: SQL = db, url = databaseUrl()) {
  try {
    return await ping.run(client);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Cannot query Postgres at ${describeDatabase(url)}: ${reason}. In dev, start it with \`bun run services:up\`.`,
      { cause: err },
    );
  }
}

/** "50%_off" → "50\%\_off": the user's search text is matched literally inside ILIKE '%…%'. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
