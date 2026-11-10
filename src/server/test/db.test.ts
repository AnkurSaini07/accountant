import { describe, expect, test } from "bun:test";
import { db as admin } from "../db.ts";
import { testDb } from "./db.ts";

const a = await testDb();
const b = await testDb();
const empty = await testDb({ migrated: false });

const currentDb = async (sql: typeof a) => (await sql`select current_database() as name`)[0].name as string;

describe("testDb", () => {
  test("gives each caller its own throwaway database", async () => {
    const [na, nb] = [await currentDb(a), await currentDb(b)];
    expect(na).toMatch(/^accountant_test_[0-9a-f]{32}$/);
    expect(nb).toMatch(/^accountant_test_[0-9a-f]{32}$/);
    expect(na).not.toBe(nb);
  });

  test("databases are migrated", async () => {
    const applied = (await a`select name from schema_migrations order by name`).map((r: { name: string }) => r.name);
    expect(applied).toContain("0001_init.sql");
    const [fn] = await a`select 1 from pg_proc where proname = 'set_updated_at'`;
    expect(fn).toBeDefined();
  });

  test("data written in one is invisible to another", async () => {
    await a`create table note (body text)`;
    await a`insert into note values ('only in a')`;
    expect((await a`select body from note`).map((r: { body: string }) => r.body)).toEqual(["only in a"]);
    const [inB] = await b`select to_regclass('note') as t`;
    expect(inB.t).toBeNull();
  });

  test("{ migrated: false } is empty", async () => {
    const [t] = await empty`select to_regclass('schema_migrations') as t`;
    expect(t.t).toBeNull();
  });

  test("only one template exists, so stale ones are cleaned up", async () => {
    const rows = await admin`select datname from pg_database where datname like 'accountant_template_%'`;
    expect(rows).toHaveLength(1);
  });
});
