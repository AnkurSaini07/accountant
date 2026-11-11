import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("GBP Currency Tests", () => {
	describe("en", () => {
		const toWords = new ToWords({ locale: "en" });
		it("should convert to GBP", () => {
			expect(toWords.numberToCurrency(1, { currency: "GBP" })).toBe(
				"one pound only",
			);
			expect(toWords.numberToCurrency(2, { currency: "GBP" })).toBe(
				"two pounds only",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "GBP" })).toBe(
				"one pound and one penny",
			);
			expect(toWords.numberToCurrency(1.02, { currency: "GBP" })).toBe(
				"one pound and two pence",
			);
		});
	});
});
