import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("EUR Currency Tests", () => {
	describe("en", () => {
		const toWords = new ToWords({ locale: "en" });
		it("should convert to EUR", () => {
			expect(toWords.numberToCurrency(1, { currency: "EUR" })).toBe(
				"one euro only",
			);
			expect(toWords.numberToCurrency(2, { currency: "EUR" })).toBe(
				"two euros only",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "EUR" })).toBe(
				"one euro and one cent",
			);
		});
	});

	describe("de", () => {
		const toWords = new ToWords({ locale: "de" });
		it("should convert to EUR", () => {
			expect(toWords.numberToCurrency(1, { currency: "EUR" })).toBe(
				"eins Euro nur",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "EUR" })).toBe(
				"eins Euro und eins Cent",
			);
		});
	});

	describe("fr", () => {
		const toWords = new ToWords({ locale: "fr" });
		it("should convert to EUR", () => {
			expect(toWords.numberToCurrency(1, { currency: "EUR" })).toBe(
				"un euro seulement",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "EUR" })).toBe(
				"un euro et un centime",
			);
		});
	});

	describe("nl", () => {
		const toWords = new ToWords({ locale: "nl" });
		it("should convert to EUR", () => {
			expect(toWords.numberToCurrency(1, { currency: "EUR" })).toBe(
				"een euro alleen",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "EUR" })).toBe(
				"een euro en een cent",
			);
		});
	});

	describe("pt", () => {
		const toWords = new ToWords({ locale: "pt" });
		it("should convert to EUR", () => {
			expect(toWords.numberToCurrency(1, { currency: "EUR" })).toBe(
				"um euro apenas",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "EUR" })).toBe(
				"um euro e um cêntimo",
			);
		});
	});
});
