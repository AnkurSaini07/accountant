import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("USD Currency Tests", () => {
	describe("en", () => {
		const toWords = new ToWords({ locale: "en-US" });
		it("should convert to USD", () => {
			expect(toWords.numberToCurrency(1, { currency: "USD" })).toBe(
				"one dollar only",
			);
			expect(toWords.numberToCurrency(2, { currency: "USD" })).toBe(
				"two dollars only",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "USD" })).toBe(
				"one dollar and one cent",
			);
		});

		it("should return correct currency for large numbers", () => {
			expect(toWords.numberToCurrency(1000000000)).toBe(
				"one billion dollars only",
			);
		});

		it("should not add 'only' when doNotAddOnly is true", () => {
			expect(toWords.numberToCurrency(100, { doNotAddOnly: true })).toBe(
				"one hundred dollars",
			);
		});
	});

	describe("es", () => {
		const toWords = new ToWords({ locale: "es" });
		it("should convert to USD", () => {
			expect(toWords.numberToCurrency(1, { currency: "USD" })).toBe(
				"uno dólar solamente",
			);
			expect(toWords.numberToCurrency(2, { currency: "USD" })).toBe(
				"dos dólares solamente",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "USD" })).toBe(
				"uno dólar y uno centavo",
			);
		});
	});

	describe("fr", () => {
		const toWords = new ToWords({ locale: "fr" });
		it("should convert to USD", () => {
			expect(toWords.numberToCurrency(1, { currency: "USD" })).toBe(
				"un dollar seulement",
			);
			expect(toWords.numberToCurrency(2, { currency: "USD" })).toBe(
				"deux dollars seulement",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "USD" })).toBe(
				"un dollar et un cent",
			);
		});
	});

	describe("de", () => {
		const toWords = new ToWords({ locale: "de" });
		it("should convert to USD", () => {
			expect(toWords.numberToCurrency(1, { currency: "USD" })).toBe(
				"eins Dollar nur",
			);
			expect(toWords.numberToCurrency(2, { currency: "USD" })).toBe(
				"zwei Dollar nur",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "USD" })).toBe(
				"eins Dollar und eins Cent",
			);
		});
	});

	describe("it", () => {
		const toWords = new ToWords({ locale: "it" });
		it("should convert to USD", () => {
			expect(toWords.numberToCurrency(1, { currency: "USD" })).toBe(
				"uno dollaro solo",
			);
			expect(toWords.numberToCurrency(2, { currency: "USD" })).toBe(
				"due dollari solo",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "USD" })).toBe(
				"uno dollaro e uno centesimo",
			);
		});
	});

	describe("hi", () => {
		const toWords = new ToWords({ locale: "hi" });
		it("should convert to USD", () => {
			expect(toWords.numberToCurrency(1, { currency: "USD" })).toBe(
				"एक डॉलर मात्र",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "USD" })).toBe(
				"एक डॉलर और एक सेंट",
			);
		});
	});
});
