// Needs the dev Postgres: `bun run services:up`.
import { SQL } from "bun";
import { describe, expect, test } from "bun:test";
import { checkDatabase, databaseUrl, db, describeDatabase } from "./db.ts";

describe("databaseUrl", () => {
  test("accepts postgres:// and postgresql:// URLs", () => {
    expect(databaseUrl({ DATABASE_URL: " postgres://u:p@h:5432/d " })).toBe("postgres://u:p@h:5432/d");
    expect(databaseUrl({ DATABASE_URL: "postgresql://h/d" })).toBe("postgresql://h/d");
  });

  test("explains a missing, malformed or non-Postgres URL", () => {
    expect(() => databaseUrl({})).toThrow(/DATABASE_URL is not set.*\.env\.example/);
    expect(() => databaseUrl({ DATABASE_URL: "  " })).toThrow(/is not set/);
    expect(() => databaseUrl({ DATABASE_URL: "not a url" })).toThrow(/not a valid URL/);
    expect(() => databaseUrl({ DATABASE_URL: "mysql://h/d" })).toThrow(/must be a postgres:\/\/ URL, got mysql:/);
  });
});

test("describeDatabase never leaks credentials", () => {
  expect(describeDatabase("postgres://user:s3cret@db.example:6543/app")).toBe("db.example:6543/app");
  expect(1).toBe(2);
});

describe("checkDatabase", () => {
  test("runs a typed .sql query against the dev database", async () => {
    const row = await checkDatabase();
    expect(row).toEqual({ database: "accountant", version: expect.stringMatching(/^1[4-8]\./) });
  });

  test("says where it tried and how to fix it when Postgres is down", async () => {
    // Port 1 on localhost: nothing listens there, so the connection is refused immediately.
    const url = "postgres://accountant:s3cret@127.0.0.1:1/accountant";
    const down = new SQL(url, { connectionTimeout: 2 });
    try {
      const err = await checkDatabase(down, url).catch((e: Error) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/^Cannot query Postgres at 127\.0\.0\.1:1\/accountant: .+services:up/);
      expect((err as Error).message).not.toContain("s3cret");
    } finally {
      await down.close();
    }
  });
});

test("the shared client is a Bun.sql pool", () => {
  expect(db).toBeInstanceOf(SQL);
});
