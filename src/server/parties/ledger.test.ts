// Each party's own ledger (#37): created with the party, kept in step with it (0010_party_ledgers.sql).
import { describe, expect, test } from "bun:test";
import { createApp } from "../app.ts";
import type { Oidc } from "../auth/oidc.ts";
import { createSession } from "../auth/sessions.ts";
import upsertUser from "../auth/upsert_user.sql";
import { testDb } from "../test/db.ts";

const db = await testDb();
const app = createApp({ db, oidc: {} as Oidc });
const user = (await upsertUser.run(db, { sub: "party-ledger", email: null, name: "Accountant", role: "accountant" }))!;
const cookie = `session=${(await createSession(db, user.id)).token}`;
const call = (method: string, path: string, body?: unknown) =>
  app.request(`/api${path}`, { method, headers: { cookie, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON for assertions
const json = async (res: Response) => (await res.json()) as any;

const party = (name: string, kind = "customer") => ({ name, kind, registration_type: "unregistered", state_code: "06" });
type Ledger = { id: number; name: string; group_name: string; active: boolean; party_id: number | null };
const ledgerOf = async (partyId: number) =>
  ((await db`select l.id, l.name, g.name as group_name, l.active, l.party_id from ledgers l join ledger_groups g on g.id = l.group_id where l.party_id = ${partyId}`) as Ledger[])[0];
const count = async (sql: Promise<unknown>) => ((await sql) as { n: number }[])[0]!.n;

describe("party ledgers", () => {
  test("a customer gets a ledger under Sundry Debtors, a supplier under Sundry Creditors, 'both' under Debtors", async () => {
    for (const [kind, group] of [["customer", "Sundry Debtors"], ["supplier", "Sundry Creditors"], ["both", "Sundry Debtors"]]) {
      const res = await call("POST", "/parties", party(`Gupta ${kind}`, kind));
      expect(res.status).toBe(201);
      const { id } = await json(res);
      expect(await ledgerOf(id)).toMatchObject({ name: `Gupta ${kind}`, group_name: group, active: true, party_id: id });
    }
  });

  test("renaming, changing kind and (de)activating the party changes its ledger", async () => {
    const { id } = await json(await call("POST", "/parties", party("Verma Traders")));
    const ledgerId = (await ledgerOf(id))!.id;
    expect((await call("PUT", `/parties/${id}`, party("Verma Steel Traders", "supplier"))).status).toBe(200);
    expect(await ledgerOf(id)).toMatchObject({ id: ledgerId, name: "Verma Steel Traders", group_name: "Sundry Creditors" });
    await call("POST", `/parties/${id}/deactivate`);
    expect(await ledgerOf(id)).toMatchObject({ active: false });
    await call("POST", `/parties/${id}/reactivate`);
    expect(await ledgerOf(id)).toMatchObject({ active: true });
  });

  test("a name another ledger has is a 409 on name, and nothing is saved (party and ledger are one write)", async () => {
    const parties = () => count(db`select count(*)::int as n from parties`);
    const before = await parties();
    for (const name of ["cash", "Verma Steel Traders"]) {
      const res = await call("POST", "/parties", party(name));
      expect(res.status).toBe(409);
      expect((await json(res)).error.details.fields.name).toEqual([`A party or ledger named ${name} already exists.`]);
    }
    expect(await parties()).toBe(before);

    const { id } = await json(await call("POST", "/parties", party("Kapoor Engg")));
    const res = await call("PUT", `/parties/${id}`, party("Round Off"));
    expect(res.status).toBe(409);
    expect(await count(db`select count(*)::int as n from parties where id = ${id} and name = 'Kapoor Engg'`)).toBe(1); // rolled back
  });

  test("a party's ledger can't be changed through the ledger API; the list shows whose it is", async () => {
    const { id } = await json(await call("POST", "/parties", party("Malhotra Forgings")));
    const ledger = (await ledgerOf(id))!;
    const bank = ((await db`select id from ledger_groups where name = 'Bank Accounts' limit 1`) as { id: number }[])[0]!.id;
    for (const [method, path, body] of [
      ["PUT", `/ledgers/${ledger.id}`, { name: "Renamed", group_id: bank }],
      ["POST", `/ledgers/${ledger.id}/deactivate`, undefined],
    ] as const) {
      const res = await call(method, path, body);
      expect(res.status).toBe(409);
      expect((await json(res)).error.message).toBe("Malhotra Forgings is a party's ledger: change the party in Masters → Parties.");
    }
    expect((await json(await call("GET", "/ledgers?q=malhotra"))).ledgers).toEqual([expect.objectContaining({ name: "Malhotra Forgings", group_name: "Sundry Debtors", party_id: id })]);
  });

  test("the migration gave parties that existed before it their ledgers", async () => {
    // Simulate a pre-0010 party: drop its ledger, then rerun the backfill statement.
    const { id } = await json(await call("POST", "/parties", party("Old Party")));
    await db`delete from ledgers where party_id = ${id}`;
    await db`update parties set name = name`;
    expect(await ledgerOf(id)).toMatchObject({ name: "Old Party", group_name: "Sundry Debtors" });
    expect(await count(db`select count(*)::int as n from parties p where not exists (select 1 from ledgers l where l.party_id = p.id)`)).toBe(0);
  });
});
