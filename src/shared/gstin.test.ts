import { describe, expect, test } from "bun:test";
import { gstinCheckChar, isValidPan, normalizeGstin, parseGstin } from "./gstin.ts";
import { STATES, stateByCode } from "./states.ts";

// GSTN's documented sample GSTIN: anchors the checksum algorithm to an external source.
const SAMPLE = "27AAPFU0939F1ZV";
// Made-up PAN in Haryana, completed with its computed check character.
const haryana = (first14 = "06AAAAA1111A1Z") => first14 + gstinCheckChar(first14);

describe("parseGstin", () => {
  test("accepts a valid GSTIN and splits it", () => {
    expect(parseGstin(SAMPLE)).toEqual({ gstin: SAMPLE, pan: "AAPFU0939F", state: { code: "27", name: "Maharashtra" } });
  });

  test("state 06 = Haryana", () => {
    const g = haryana();
    expect(parseGstin(g).state.name).toBe("Haryana");
    expect(parseGstin(g).pan).toBe("AAAAA1111A");
  });

  test("lowercase and spaces are normalized", () => {
    expect(parseGstin(" 27aapfu0939f1zv ").gstin).toBe(SAMPLE);
    expect(parseGstin("27 AAPFU 0939F 1ZV").gstin).toBe(SAMPLE);
    expect(normalizeGstin("27aap fu0939f1zv")).toBe(SAMPLE);
  });

  test("bad check character", () => {
    expect(() => parseGstin("27AAPFU0939F1ZW")).toThrow(/check digit/);
  });

  test("any single-character typo is caught", () => {
    for (let i = 0; i < 15; i++) {
      for (const c of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        if (c === SAMPLE[i]) continue;
        const typo = SAMPLE.slice(0, i) + c + SAMPLE.slice(i + 1);
        expect(() => parseGstin(typo)).toThrow(RangeError);
      }
    }
  });

  test.each([
    ["", /15 characters/],
    ["27AAPFU0939F1Z", /15 characters/], // 14 chars
    ["27AAPFU0939F1ZVX", /15 characters/],
    ["2AAAPFU0939F1ZV", /15 characters/], // letter in state code
    ["27AAPF10939F1ZV", /15 characters/], // digit where PAN needs a letter
    ["27AAPFU0939F0ZV", /15 characters/], // entity number can't be 0
    ["27AAPFU0939F1Z-", /15 characters/],
    ["99AAAAA1111A1Z" + gstinCheckChar("99AAAAA1111A1Z"), /99, which is not an Indian state code/],
  ])("rejects %p", (input, message) => {
    expect(() => parseGstin(input)).toThrow(message);
  });
});

test("isValidPan", () => {
  for (const ok of ["AAPFU0939F", "aapfu0939f", "AAPFU 0939F"]) expect(isValidPan(ok)).toBe(true);
  for (const bad of ["", "AAPFU0939", "AAPF10939F", "AAPFU09391", "AAPFU0939FF", "AAPFU-0939F"]) expect(isValidPan(bad)).toBe(false);
});

describe("states", () => {
  test("codes are unique, two digits and sorted", () => {
    const codes = STATES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((c) => /^\d{2}$/.test(c))).toBe(true);
    expect([...codes].sort()).toEqual(codes);
  });

  test("lookups", () => {
    expect(stateByCode("06")?.name).toBe("Haryana");
    expect(stateByCode(6)?.name).toBe("Haryana");
    expect(stateByCode("07")?.name).toBe("Delhi");
    expect(stateByCode("37")?.name).toBe("Andhra Pradesh");
    expect(stateByCode("00")).toBeUndefined();
    expect(stateByCode("99")).toBeUndefined();
  });

  test("UTGST applies to UTs without a legislature only", () => {
    const utgst = STATES.filter((s) => s.utgst && !s.legacy).map((s) => s.name);
    expect(utgst).toEqual([
      "Chandigarh",
      "Dadra and Nagar Haveli and Daman and Diu",
      "Lakshadweep",
      "Andaman and Nicobar Islands",
      "Ladakh",
      "Other Territory",
    ]);
    // Delhi, Puducherry and J&K have legislatures, so they charge SGST.
    for (const code of ["07", "34", "01"]) expect(stateByCode(code)?.utgst).toBeUndefined();
  });
});
