// `bun run migrate`: applies pending migrations to DATABASE_URL.
import { db, describeDatabase, databaseUrl } from "../src/server/db.ts";
import { migrate } from "../src/server/migrate.ts";

try {
  const applied = await migrate(db);
  const where = describeDatabase(databaseUrl());
  console.log(applied.length ? `Applied to ${where}:\n${applied.map((n) => `  ${n}`).join("\n")}` : `${where} is up to date.`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await db.close();
}
