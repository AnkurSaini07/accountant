import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("RUB Currency Tests", () => {
	describe("en", () => {
		const toWords = new ToWords({ locale: "en" });
		it("should convert to RUB", () => {
			expect(toWords.numberToCurrency(1, { currency: "RUB" })).toBe(
				"one ruble only",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "RUB" })).toBe(
				"one ruble and one kopek",
			);
		});
	});
	describe("ru", () => {
		const toWords = new ToWords({ locale: "ru" });
		it("should convert to RUB", () => {
			expect(toWords.numberToCurrency(1, { currency: "RUB" })).toBe(
				"один рубль только",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "RUB" })).toBe(
				"один рубль и один копейка",
			);
		});
	});
});
