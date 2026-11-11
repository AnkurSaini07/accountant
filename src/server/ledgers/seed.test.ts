import { describe, expect, test } from "bun:test";
import { testDb } from "../test/db.ts";
import listGroups from "./list_groups.sql";

const db = await testDb();
const [{ id: co }] = await db`select id from companies order by id limit 1`;
type Row = Record<string, unknown>;
const ledger = async (company: number, key: string) =>
  ((await db`select l.name, l.is_system, g.name as grp, g.nature from ledgers l join ledger_groups g on g.id = l.group_id where l.company_id = ${company} and l.system_key = ${key}`) as Row[])[0];
const groupId = async (company: number, name: string) => ((await db`select id from ledger_groups where company_id = ${company} and name = ${name}`) as { id: number }[])[0]!.id;

describe("seeded chart of accounts", () => {
  test("the group tree: Tally's primary groups with their sub-groups, in order", async () => {
    const tree = await listGroups.run(db, { company_id: co });
    expect(tree.map((g) => `${"  ".repeat(g.depth)}${g.name}`)).toEqual([
      "Capital Account",
      "Current Assets",
      "  Bank Accounts",
      "  Cash-in-Hand",
      "  Deposits (Asset)",
      "  Loans & Advances (Asset)",
      "  Stock-in-Hand",
      "  Sundry Debtors",
      "Current Liabilities",
      "  Duties & Taxes",
      "  Provisions",
      "  Sundry Creditors",
      "Direct Expenses",
      "Direct Incomes",
      "Fixed Assets",
      "Indirect Expenses",
      "Indirect Incomes",
      "Investments",
      "Loans (Liability)",
      "Purchase Accounts",
      "Sales Accounts",
    ]);
    expect(tree.every((g) => g.is_system)).toBe(true);
  });

  test("every group has a nature, and sub-groups share their parent's", async () => {
    const tree = await listGroups.run(db, { company_id: co });
    const byId = new Map(tree.map((g) => [g.id, g]));
    for (const g of tree) {
      expect(["asset", "liability", "income", "expense"]).toContain(g.nature);
      if (g.parent_id) expect(g.nature).toBe(byId.get(g.parent_id)!.nature);
    }
    const nature = Object.fromEntries(tree.map((g) => [g.name, g.nature]));
    expect([nature["Sundry Debtors"], nature["Sundry Creditors"], nature["Sales Accounts"], nature["Indirect Expenses"]]).toEqual(["asset", "liability", "income", "expense"]);
  });

  test("system ledgers, each under its group, found by key", async () => {
    const expected: [string, string, string, string][] = [
      ["cash", "Cash", "Cash-in-Hand", "asset"],
      ["sales", "Sales", "Sales Accounts", "income"],
      ["purchase", "Purchase", "Purchase Accounts", "expense"],
      ["output_cgst", "Output CGST", "Duties & Taxes", "liability"],
      ["output_sgst", "Output SGST", "Duties & Taxes", "liability"],
      ["output_igst", "Output IGST", "Duties & Taxes", "liability"],
      ["input_cgst", "Input CGST", "Duties & Taxes", "liability"],
      ["input_sgst", "Input SGST", "Duties & Taxes", "liability"],
      ["input_igst", "Input IGST", "Duties & Taxes", "liability"],
      ["round_off", "Round Off", "Indirect Expenses", "expense"],
    ];
    for (const [key, name, grp, nature] of expected) expect(await ledger(co, key)).toEqual({ name, is_system: true, grp, nature });
    expect(((await db`select count(*)::int as n from ledgers where company_id = ${co}`) as { n: number }[])[0]!.n).toBe(expected.length);
  });

  test("a new company gets its own chart automatically", async () => {
    const [{ id: fresh }] = await db`insert into companies (legal_name, state_code) values ('Second Firm', '07') returning id`;
    expect((await listGroups.run(db, { company_id: fresh })).length).toBe(21);
    expect(await ledger(fresh, "round_off")).toMatchObject({ name: "Round Off", grp: "Indirect Expenses" });
    expect(await groupId(fresh, "Sundry Debtors")).not.toBe(await groupId(co, "Sundry Debtors"));
  });
});

describe("rules", () => {
  test("system groups and ledgers can't be changed or deleted", async () => {
    await expect(db`delete from ledgers where company_id = ${co} and system_key = 'cash'`).rejects.toThrow("Cash is a system ledger and can't be changed or deleted");
    await expect(db`update ledgers set name = 'Petty Cash' where company_id = ${co} and system_key = 'cash'`).rejects.toThrow(/can't be changed/);
    await expect(db`delete from ledger_groups where company_id = ${co} and name = 'Bank Accounts'`).rejects.toThrow("Bank Accounts is a system ledger group and can't be changed or deleted");
    await expect(db`update ledger_groups set nature = 'income' where company_id = ${co} and name = 'Capital Account'`).rejects.toThrow(/can't be changed/);
    expect(await ledger(co, "cash")).toMatchObject({ name: "Cash" });
  });

  test("user ledgers and groups can be added, changed and deleted", async () => {
    const bank = await groupId(co, "Bank Accounts");
    const [{ id }] = await db`insert into ledgers (company_id, group_id, name) values (${co}, ${bank}, 'HDFC Current A/c') returning id`;
    await db`update ledgers set name = 'HDFC Bank 5010' where id = ${id}`;
    await db`delete from ledgers where id = ${id}`;
    const [{ id: sub }] = await db`insert into ledger_groups (company_id, parent_id, name, nature) values (${co}, ${await groupId(co, "Indirect Expenses")}, 'Factory Overheads', 'expense') returning id`;
    await db`delete from ledger_groups where id = ${sub}`;
  });

  test("a sub-group must share its parent's nature and company", async () => {
    const debtors = await groupId(co, "Sundry Debtors");
    await expect(db`insert into ledger_groups (company_id, parent_id, name, nature) values (${co}, ${debtors}, 'Export Debtors', 'liability')`).rejects.toThrow(/same company and nature/);
    const [{ id: other }] = await db`insert into companies (legal_name, state_code) values ('Third Firm', '06') returning id`;
    await expect(db`insert into ledger_groups (company_id, parent_id, name, nature) values (${other}, ${debtors}, 'Cross', 'asset')`).rejects.toThrow(/same company and nature/);
    await expect(db`insert into ledger_groups (company_id, parent_id, name, nature) values (${co}, ${debtors}, 'Export Debtors', 'asset')`).resolves.toBeDefined();
  });

  test("names unique per company ignoring case; system keys unique and only on system ledgers", async () => {
    const cashGroup = await groupId(co, "Cash-in-Hand");
    await expect(db`insert into ledgers (company_id, group_id, name) values (${co}, ${cashGroup}, 'cash')`).rejects.toThrow(/ledgers_company_name/);
    await expect(db`insert into ledger_groups (company_id, name, nature) values (${co}, 'sundry debtors', 'asset')`).rejects.toThrow(/ledger_groups_company_name/);
    await expect(db`insert into ledgers (company_id, group_id, name, system_key) values (${co}, ${cashGroup}, 'Fake', 'cash')`).rejects.toThrow(/check|unique|duplicate/);
  });
});
