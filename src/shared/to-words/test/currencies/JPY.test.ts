import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("JPY Currency Tests", () => {
	describe("en", () => {
		const toWords = new ToWords({ locale: "en" });
		it("should convert to JPY", () => {
			expect(toWords.numberToCurrency(1, { currency: "JPY" })).toBe(
				"one yen only",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "JPY" })).toBe(
				"one yen and one sen",
			);
		});
	});

	describe("ja", () => {
		const toWords = new ToWords({ locale: "ja" });
		it("should convert to JPY", () => {
			expect(toWords.numberToCurrency(1, { currency: "JPY" })).toBe(
				"一 円 のみ",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "JPY" })).toBe(
				"一 円 と 一 銭",
			);
		});
	});
});
