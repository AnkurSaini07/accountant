// Playwright's web server: a fresh `<db>_e2e` database (dropped, recreated, migrated), then the app
// with NODE_ENV=test so POST /api/test/login exists. Never touches the dev database's data.
import { SQL } from "bun";
import { migrate } from "../src/server/migrate.ts";

// Not via src/server/db.ts: importing it opens the app's pool on the dev URL before we switch it.
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example).");
const base = new URL(process.env.DATABASE_URL);
const e2e = new URL(base);
e2e.pathname = `${base.pathname.slice(1)}_e2e`;
const name = e2e.pathname.slice(1);

const admin = new SQL(base.href);
await admin.unsafe(`drop database if exists "${name}" with (force)`);
await admin.unsafe(`create database "${name}"`);
await admin.close();

const fresh = new SQL(e2e.href);
await migrate(fresh);
await fresh.close();

Object.assign(process.env, { DATABASE_URL: e2e.href, NODE_ENV: "test" });
await import("../src/server/index.ts"); // reads DATABASE_URL at import, so after the env is set
