import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("CNY Currency Tests", () => {
	describe("en", () => {
		const toWords = new ToWords({ locale: "en" });
		it("should convert to CNY", () => {
			expect(toWords.numberToCurrency(1, { currency: "CNY" })).toBe(
				"one yuan only",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "CNY" })).toBe(
				"one yuan and one fen",
			);
		});
	});
	describe("zh", () => {
		const toWords = new ToWords({ locale: "zh" });
		it("should convert to CNY", () => {
			expect(toWords.numberToCurrency(1, { currency: "CNY" })).toBe("一 元 整");
			expect(toWords.numberToCurrency(1.01, { currency: "CNY" })).toBe(
				"一 元 和 一 分",
			);
		});
	});
});
