import { expect, test } from "bun:test";
import { formatQty, parseQty } from "./quantity.ts";

test("parseQty: text to smallest steps, exactly", () => {
  expect([parseQty("1.25", 3), parseQty("1.250", 3), parseQty("0.1", 3), parseQty("12", 3), parseQty("7.", 2), parseQty("1,000", 0), parseQty(" 5 ", 0)]).toEqual([1250, 1250, 100, 12000, 700, 1000, 5]);
  expect(parseQty("0.001", 3)).toBe(1);
});

test("parseQty refuses extra decimals, negatives, junk and overflow", () => {
  for (const [text, d] of [["1.2345", 3], ["1.5", 0], ["-1", 3], ["", 0], ["1e3", 0], ["abc", 2], ["9007199254740993", 0]] as const) {
    expect(() => parseQty(text, d)).toThrow(RangeError);
  }
  expect(() => parseQty("1.5", 0)).toThrow("Enter a whole number.");
  expect(() => parseQty("1.2345", 3)).toThrow("at most 3 decimals");
});

test("formatQty is the inverse", () => {
  expect([formatQty(1250, 3), formatQty(1, 3), formatQty(0, 3), formatQty(12, 0), formatQty(700, 2)]).toEqual(["1.250", "0.001", "0.000", "12", "7.00"]);
  for (const [n, d] of [[1250, 3], [5, 0], [123456789, 2]] as const) expect(parseQty(formatQty(n, d), d)).toBe(n);
});
