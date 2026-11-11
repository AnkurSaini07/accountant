import { describe, expect, test } from "bun:test";
import { amountInWords, numberInWords } from "./words.ts";

describe("amountInWords", () => {
  test.each([
    [0, "Rupees Zero Only"],
    [100, "Rupees One Only"],
    [1, "One Paisa Only"],
    [50, "Fifty Paise Only"],
    [101, "Rupees One and One Paisa Only"],
    [12345650, "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Fifty Paise Only"],
    [100000 * 100, "Rupees One Lakh Only"],
    [10000000 * 100, "Rupees One Crore Only"],
    [
      99999999999,
      "Rupees Ninety Nine Crore Ninety Nine Lakh Ninety Nine Thousand Nine Hundred Ninety Nine and Ninety Nine Paise Only",
    ],
    [1500000000 * 100, "Rupees One Arab Fifty Crore Only"], // to-words' Indian units; see words.ts
    [1001 * 100, "Rupees One Thousand One Only"],
    [110 * 100 + 5, "Rupees One Hundred Ten and Five Paise Only"],
  ])("%p paise → %p", (paise, words) => {
    expect(amountInWords(paise)).toBe(words);
  });

  test("rejects negative and fractional paise", () => {
    expect(() => amountInWords(-1)).toThrow(RangeError);
    expect(() => amountInWords(1.5)).toThrow(RangeError);
    expect(() => amountInWords(Number.NaN)).toThrow(RangeError);
  });
});

describe("numberInWords", () => {
  test.each([
    [0, "Zero"],
    [7, "Seven"],
    [13, "Thirteen"],
    [20, "Twenty"],
    [21, "Twenty One"],
    [90, "Ninety"],
    [100, "One Hundred"],
    [999, "Nine Hundred Ninety Nine"],
    [100000, "One Lakh"],
    [1000010, "Ten Lakh Ten"],
    [12_34_56_789, "Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine"],
    [10_00_00_00_000, "Ten Arab"],
  ])("%p → %p", (n, words) => {
    expect(numberInWords(n)).toBe(words);
  });
});
