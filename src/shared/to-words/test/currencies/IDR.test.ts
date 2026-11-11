import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("IDR Currency Tests", () => {
	describe("en", () => {
		const toWords = new ToWords({ locale: "en" });
		it("should convert to IDR", () => {
			expect(toWords.numberToCurrency(1, { currency: "IDR" })).toBe(
				"one rupiah only",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "IDR" })).toBe(
				"one rupiah and one sen",
			);
		});
	});
	describe("id", () => {
		const toWords = new ToWords({ locale: "id" });
		it("should convert to IDR", () => {
			expect(toWords.numberToCurrency(1, { currency: "IDR" })).toBe(
				"satu rupiah saja",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "IDR" })).toBe(
				"satu rupiah dan satu sen",
			);
		});
	});
});
