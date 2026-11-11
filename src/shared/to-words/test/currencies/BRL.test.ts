import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("BRL Currency Tests", () => {
	describe("en", () => {
		const toWords = new ToWords({ locale: "en" });
		it("should convert to BRL", () => {
			expect(toWords.numberToCurrency(1, { currency: "BRL" })).toBe(
				"one real only",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "BRL" })).toBe(
				"one real and one centavo",
			);
		});
	});
	describe("pt", () => {
		const toWords = new ToWords({ locale: "pt" });
		it("should convert to BRL", () => {
			expect(toWords.numberToCurrency(1, { currency: "BRL" })).toBe(
				"um real apenas",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "BRL" })).toBe(
				"um real e um centavo",
			);
		});
	});
});
