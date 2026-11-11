import { describe, expect, test } from "bun:test";
import { AppError } from "../errors.ts";
import { testDb } from "../test/db.ts";
import { DOC_TYPES, formatNumber, nextNumber } from "./series.ts";

const db = await testDb();
const [{ id: companyId }] = await db`select id from companies order by id limit 1`;
const [{ id: otherCompany }] = await db`insert into companies (legal_name, state_code) values ('Other Firm', '07') returning id`;
const take = (docType: (typeof DOC_TYPES)[number], date: string, company = companyId) => db.begin((tx) => nextNumber(tx, { companyId: company, docType, date }));

describe("formatNumber", () => {
  test("fills {FY} and pads; numbers past the padding just get longer", () => {
    expect(formatNumber("INV/{FY}/", 2026, 7, 4)).toBe("INV/26-27/0007");
    expect(formatNumber("DC-", 2026, 12345, 4)).toBe("DC-12345");
    expect(formatNumber("", 2099, 1, 1)).toBe("1");
  });
});

describe("nextNumber", () => {
  test("starts at 1 and counts up, per document type and per company", async () => {
    expect(await take("invoice", "2026-05-10")).toBe("INV/26-27/0001");
    expect(await take("invoice", "2026-06-01")).toBe("INV/26-27/0002");
    expect(await take("challan", "2026-06-01")).toBe("DC/26-27/0001");
    expect(await take("invoice", "2026-06-01", otherCompany)).toBe("INV/26-27/0001");
    expect(await take("invoice", "2026-06-02")).toBe("INV/26-27/0003");
  });

  test("restarts every financial year (1 April)", async () => {
    expect(await take("receipt", "2027-03-31")).toBe("RCT/26-27/0001");
    expect(await take("receipt", "2027-04-01")).toBe("RCT/27-28/0001");
    expect(await take("receipt", "2027-03-31")).toBe("RCT/26-27/0002"); // a late entry for the old year
  });

  test("concurrent calls never get the same number, and none are skipped", async () => {
    const numbers = await Promise.all(Array.from({ length: 40 }, () => take("payment", "2026-07-01")));
    expect(new Set(numbers).size).toBe(40);
    expect(numbers.toSorted()).toEqual(Array.from({ length: 40 }, (_, i) => `PMT/26-27/${String(i + 1).padStart(4, "0")}`));
  });

  test("a rolled-back document gives its number back (no gaps)", async () => {
    expect(await take("journal", "2026-08-01")).toBe("JV/26-27/0001");
    await expect(
      db.begin(async (tx) => {
        expect(await nextNumber(tx, { companyId, docType: "journal", date: "2026-08-01" })).toBe("JV/26-27/0002");
        throw new Error("saving the document failed");
      }),
    ).rejects.toThrow("saving the document failed");
    expect(await take("journal", "2026-08-01")).toBe("JV/26-27/0002");
  });

  test("more than 16 characters is an error, and doesn't use up the number", async () => {
    await take("quotation", "2026-09-01"); // creates the series
    await db`update number_series set prefix = 'QUOTATION/{FY}/' where doc_type = 'quotation' and company_id = ${companyId}`;
    const error = await take("quotation", "2026-09-01").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 422, code: "NUMBER_TOO_LONG", details: { number: "QUOTATION/26-27/0002" } });
    await db`update number_series set prefix = 'Q/{FY}/' where doc_type = 'quotation' and company_id = ${companyId}`;
    expect(await take("quotation", "2026-09-01")).toBe("Q/26-27/0002");
  });

  test("exactly 16 characters is allowed", async () => {
    await take("grn", "2026-09-01");
    await db`update number_series set prefix = 'GRNABC/{FY}/' where doc_type = 'grn' and company_id = ${companyId}`; // 6+1+5+1 = 13, + 3 digits
    await db`update number_series set padding = 3 where doc_type = 'grn' and company_id = ${companyId}`;
    expect(await take("grn", "2026-09-01")).toBe("GRNABC/26-27/002");
  });
});

describe("database", () => {
  test("accepts every DOC_TYPES value and nothing else", async () => {
    for (const docType of DOC_TYPES) await take(docType, "2030-04-01", otherCompany);
    await expect(db`insert into number_series (company_id, doc_type, fy, prefix) values (${companyId}, 'memo', 2026, 'M/')`).rejects.toThrow(/check/);
  });

  test("prefixes may only use letters, digits, / and - (GST)", async () => {
    for (const bad of ["INV #", "INV {fy}", "इनवॉइस/"]) {
      await expect(db`insert into number_series (company_id, doc_type, fy, prefix) values (${companyId}, 'invoice', 2040, ${bad})`).rejects.toThrow(/check/);
    }
  });
});
