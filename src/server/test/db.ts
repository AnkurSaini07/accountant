// Isolated Postgres databases for tests: `const db = await testDb();` at the top of a test file
// (or in beforeAll). Each call gets its own database, copied from a migrated template, dropped in afterAll.
import { SQL } from "bun";
import { afterAll } from "bun:test";
import { join } from "node:path";
import { databaseUrl, db as admin } from "../db.ts";
import { loadMigrations, migrate } from "../migrate.ts";

const MIGRATIONS = join(import.meta.dir, "../../../migrations");
const LOCK_ID = 7_301_002; // serializes template builds across parallel test processes

const urlFor = (name: string) => {
  const url = new URL(databaseUrl());
  url.pathname = `/${name}`;
  return url.toString();
};

/** Name of a template database holding the current migrations, building it if needed. */
async function template(): Promise<string> {
  const migrations = await loadMigrations(MIGRATIONS);
  const hash = new Bun.CryptoHasher("sha256").update(migrations.map((m) => m.checksum).join()).digest("hex");
  const name = `accountant_template_${hash.slice(0, 16)}`;

  const conn = await admin.reserve(); // session advisory locks need one fixed connection
  try {
    await conn`select pg_advisory_lock(${LOCK_ID})`;
    const [exists] = await conn`select 1 from pg_database where datname = ${name}`;
    if (!exists) {
      // Stale templates (built from older migrations) are just clutter now.
      for (const { datname } of await conn`select datname from pg_database where datname like 'accountant_template_%'`) {
        await conn.unsafe(`drop database "${datname}" with (force)`);
      }
      await conn.unsafe(`create database "${name}_building"`);
      const build = new SQL(urlFor(`${name}_building`), { max: 1 });
      try {
        await migrate(build, MIGRATIONS);
      } finally {
        await build.close();
      }
      // Rename only once complete, so a crashed build is never mistaken for a good template.
      await conn.unsafe(`alter database "${name}_building" rename to "${name}"`);
    }
    return name;
  } catch (err) {
    await conn.unsafe(`drop database if exists "${name}_building" with (force)`).catch(() => {});
    throw err;
  } finally {
    await conn`select pg_advisory_unlock(${LOCK_ID})`.catch(() => {});
    conn.release();
  }
}

/**
 * A fresh database for this test file. Migrated by default; `{ migrated: false }` gives an empty one.
 * Must be called at the top level of a test file or in beforeAll, because it registers an afterAll to drop it.
 */
export async function testDb({ migrated = true } = {}): Promise<SQL> {
  const from = migrated ? await template() : "template0";
  const name = `accountant_test_${crypto.randomUUID().replaceAll("-", "")}`;
  // Copying a template refuses while anyone else is connected to it; our builds always disconnect first.
  await admin.unsafe(`create database "${name}" template "${from}"`);
  const db = new SQL(urlFor(name));
  afterAll(async () => {
    await db.close();
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
  });
  return db;
}
