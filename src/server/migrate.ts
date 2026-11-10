// Forward-only SQL migrations: migrations/NNNN_name.sql, applied in order, one transaction each,
// recorded in schema_migrations. Safe to run repeatedly and concurrently (advisory lock).
import type { SQL } from "bun";
import { join } from "node:path";

const FILE = /^(\d{4})_[a-z0-9_]+\.sql$/;
const LOCK_ID = 7_301_001; // arbitrary, app-wide id for pg_advisory_xact_lock

export type Migration = { name: string; sql: string; checksum: string };

/** Reads migration files sorted by number. Rejects badly named files and duplicate numbers. */
export async function loadMigrations(dir: string): Promise<Migration[]> {
  const names = [...new Bun.Glob("*.sql").scanSync(dir)].sort();
  const seen = new Map<string, string>();
  const out: Migration[] = [];
  for (const name of names) {
    const num = FILE.exec(name)?.[1];
    if (!num) throw new Error(`Bad migration file name ${name}: expected NNNN_lower_snake.sql`);
    if (seen.has(num)) throw new Error(`Migrations ${seen.get(num)} and ${name} share number ${num}`);
    seen.set(num, name);
    const sql = await Bun.file(join(dir, name)).text();
    out.push({ name, sql, checksum: new Bun.CryptoHasher("sha256").update(sql).digest("hex") });
  }
  return out;
}

/** Applies pending migrations. Returns the names applied (empty when up to date). */
export async function migrate(db: SQL, dir = join(import.meta.dir, "../../migrations")): Promise<string[]> {
  const migrations = await loadMigrations(dir);
  // Under the lock: `create table if not exists` alone races when two runners start together.
  await db.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${LOCK_ID})`;
    await tx`create table if not exists schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )`;
  });

  const applied: string[] = [];
  for (const m of migrations) {
    const ran = await db.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${LOCK_ID})`;
      const [done] = await tx`select checksum from schema_migrations where name = ${m.name}`;
      if (done) {
        if (done.checksum !== m.checksum) {
          throw new Error(`Migration ${m.name} was edited after it was applied. Add a new migration instead.`);
        }
        return false;
      }
      try {
        await tx.unsafe(m.sql); // trusted file from the repo; may hold several statements
      } catch (err) {
        throw new Error(`Migration ${m.name} failed and was rolled back: ${(err as Error).message}`, { cause: err });
      }
      await tx`insert into schema_migrations (name, checksum) values (${m.name}, ${m.checksum})`;
      return true;
    });
    if (ran) applied.push(m.name);
  }
  return applied;
}
