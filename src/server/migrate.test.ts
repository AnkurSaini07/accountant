// Each test gets its own throwaway database on the dev Postgres (`bun run services:up`).
import { SQL } from "bun";
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { databaseUrl, db } from "./db.ts";
import { loadMigrations, migrate } from "./migrate.ts";

const cleanups: (() => Promise<unknown> | void)[] = [];
afterAll(async () => {
  for (const c of cleanups.reverse()) await c();
});

/** A fresh empty database and a migrations dir holding `files`. */
async function setup(files: Record<string, string>) {
  const name = `migrate_test_${crypto.randomUUID().replaceAll("-", "")}`;
  await db.unsafe(`create database ${name}`);
  const url = new URL(databaseUrl());
  url.pathname = `/${name}`;
  const conn = new SQL(url.toString());
  cleanups.push(() => db.unsafe(`drop database if exists ${name} with (force)`), () => conn.close());

  const dir = mkdtempSync(join(tmpdir(), "migrations-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  for (const [file, sql] of Object.entries(files)) await Bun.write(join(dir, file), sql);
  return { conn, dir, write: (file: string, sql: string) => Bun.write(join(dir, file), sql) };
}

const tables = async (conn: SQL) =>
  (await conn`select tablename from pg_tables where schemaname = 'public' order by 1`).map((r: { tablename: string }) => r.tablename);

describe("migrate", () => {
  test("applies everything to a fresh database, in number order", async () => {
    const { conn, dir } = await setup({
      "0002_b.sql": "create table b (a_id int references a(id));",
      "0001_a.sql": "create table a (id int primary key); insert into a values (1);",
    });
    expect(await migrate(conn, dir)).toEqual(["0001_a.sql", "0002_b.sql"]);
    expect(await tables(conn)).toEqual(["a", "b", "schema_migrations"]);
  });

  test("re-running is a no-op and only pending migrations run", async () => {
    const { conn, dir, write } = await setup({ "0001_a.sql": "create table a (id int);" });
    await migrate(conn, dir);
    expect(await migrate(conn, dir)).toEqual([]);

    await write("0002_b.sql", "create table b (id int);");
    expect(await migrate(conn, dir)).toEqual(["0002_b.sql"]);
  });

  test("a failing migration rolls back entirely and stops the run", async () => {
    const { conn, dir } = await setup({
      "0001_ok.sql": "create table ok (id int);",
      "0002_bad.sql": "create table half (id int); select * from no_such_table;",
      "0003_later.sql": "create table later (id int);",
    });
    await expect(migrate(conn, dir)).rejects.toThrow(/0002_bad\.sql failed and was rolled back: .*no_such_table/);
    expect(await tables(conn)).not.toContain("half");
    expect(await tables(conn)).toEqual(["ok", "schema_migrations"]);
    expect((await conn`select name from schema_migrations`).map((r: { name: string }) => r.name)).toEqual(["0001_ok.sql"]);
  });

  test("refuses to continue when an applied migration was edited", async () => {
    const { conn, dir, write } = await setup({ "0001_a.sql": "create table a (id int);" });
    await migrate(conn, dir);
    await write("0001_a.sql", "create table a (id bigint);");
    await expect(migrate(conn, dir)).rejects.toThrow(/0001_a\.sql was edited after it was applied/);
  });

  test("concurrent runs apply each migration exactly once", async () => {
    const { conn, dir } = await setup({ "0001_a.sql": "create table a (id int);", "0002_b.sql": "create table b (id int);" });
    const runs = await Promise.all([migrate(conn, dir), migrate(conn, dir), migrate(conn, dir)]);
    expect(runs.flat().sort()).toEqual(["0001_a.sql", "0002_b.sql"]);
  });

  test("the repo's own migrations apply cleanly", async () => {
    const { conn } = await setup({});
    const applied = await migrate(conn);
    expect(applied[0]).toBe("0001_init.sql");
    expect(await migrate(conn)).toEqual([]);
  });
});

describe("loadMigrations", () => {
  test("rejects bad names and duplicate numbers", async () => {
    const bad = await setup({ "1_init.sql": "" });
    await expect(loadMigrations(bad.dir)).rejects.toThrow(/Bad migration file name 1_init\.sql/);
    const dup = await setup({ "0001_a.sql": "", "0001_b.sql": "" });
    await expect(loadMigrations(dup.dir)).rejects.toThrow(/0001_a\.sql and 0001_b\.sql share number 0001/);
  });
});
