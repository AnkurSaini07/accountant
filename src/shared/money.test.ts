import { describe, expect, test } from "bun:test";
import { assertPaise, formatRupees, multiply, parseRupees, percentOf } from "./money.ts";

const CRORE = 100_00_000 * 100; // ₹1 crore in paise

describe("parseRupees", () => {
  test.each([
    ["0", 0],
    ["1", 100],
    ["1.5", 150],
    ["1.05", 105],
    ["100.", 10000],
    ["1,23,456.50", 12345650],
    ["123,456.50", 12345650], // international grouping too
    ["  ₹ 99.99 ", 9999],
    ["-12.05", -1205],
    ["99,99,99,999.99", 99999999999],
  ])("%p → %p paise", (input, paise) => {
    expect(parseRupees(input)).toBe(paise);
  });

  test.each(["", " ", "-", "abc", "1.234", "1e5", "12.3.4", "1,2", "₹", "+5", "NaN", "Infinity", "0x10", "1,23,4567"])(
    "rejects %p",
    (input) => {
      expect(() => parseRupees(input)).toThrow(RangeError);
    },
  );
});

describe("formatRupees", () => {
  test("uses Indian lakh/crore grouping and always 2 decimals", () => {
    expect(formatRupees(0)).toBe("0.00");
    expect(formatRupees(5)).toBe("0.05");
    expect(formatRupees(12345650)).toBe("1,23,456.50");
    expect(formatRupees(CRORE)).toBe("1,00,00,000.00");
    expect(formatRupees(99999999999)).toBe("99,99,99,999.99");
  });

  test("negatives and symbol", () => {
    expect(formatRupees(-12345650)).toBe("-1,23,456.50");
    expect(formatRupees(-5, { symbol: true })).toBe("-₹0.05");
    expect(formatRupees(150000, { symbol: true })).toBe("₹1,500.00");
  });

  test("exact for the largest safe amounts (no float drift)", () => {
    expect(formatRupees(Number.MAX_SAFE_INTEGER)).toBe("9,00,71,99,25,47,409.91");
  });

  test("round-trips with parseRupees", () => {
    for (const p of [0, 1, -1, 99, 12345650, 50 * CRORE + 7]) expect(parseRupees(formatRupees(p))).toBe(p);
  });
});

describe("multiply", () => {
  test("exact where floats get it wrong: ₹19.99 × 2.345 = ₹46.87655 → ₹46.88", () => {
    expect(1999 * 2.345).not.toBe(4687.655); // the float trap this avoids
    expect(multiply(1999, 2.345)).toBe(4688);
    expect(multiply(1999, "2.345")).toBe(4688);
  });

  test("rounds half away from zero", () => {
    expect(multiply(1, 0.5)).toBe(1); // 0.5 → 1
    expect(multiply(1, 0.49)).toBe(0);
    expect(multiply(-1, 0.5)).toBe(-1); // -0.5 → -1
    expect(multiply(3, "-0.5")).toBe(-2); // -1.5 → -2
  });

  test("whole quantities and crore-size values", () => {
    expect(multiply(12500, 4)).toBe(50000);
    expect(multiply(CRORE, 1000)).toBe(1000 * CRORE);
  });

  test("rejects bad factors and amounts", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 1e-7, "1/2", "", "1e3"]) {
      expect(() => multiply(100, bad)).toThrow(RangeError);
    }
    expect(() => multiply(1.5, 2)).toThrow(/Not a valid paise amount/);
    expect(() => multiply(Number.MAX_SAFE_INTEGER, 2)).toThrow(/out of range/);
  });
});

describe("percentOf", () => {
  test("GST-style percentages", () => {
    expect(percentOf(100000, 18)).toBe(18000); // 18% of ₹1,000
    expect(percentOf(100000, "2.5")).toBe(2500);
    expect(percentOf(999, 18)).toBe(180); // 179.82 → 180
    expect(percentOf(1, 50)).toBe(1); // 0.5 → 1
    expect(percentOf(-999, 18)).toBe(-180);
    expect(percentOf(12345, 0)).toBe(0);
    expect(percentOf(37 * CRORE, 28)).toBe(Math.round(37 * CRORE * 0.28));
  });
});

test("assertPaise", () => {
  expect(assertPaise(-5)).toBe(-5);
  expect(() => assertPaise(0.1)).toThrow(RangeError);
  expect(() => assertPaise(Number.NaN)).toThrow(RangeError);
});
