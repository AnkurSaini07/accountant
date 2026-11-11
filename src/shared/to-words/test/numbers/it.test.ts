import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("IT Tests", () => {
	// Base language
	describe("it", () => {
		const toWords = new ToWords({ locale: "it" });

		it("should return supported systems", () => {
			expect(toWords.getSupportedSystems()).toEqual(["it (International)"]);
		});

		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("it (International)");
		});

		it("should convert 1234567 (default)", () => {
			expect(toWords.numberToWords(1234567)).toBe(
				"uno milione due cento trenta quattro mille cinque cento sessanta sette",
			);
		});
		it("should convert 1000001 (default)", () => {
			expect(toWords.numberToWords(1000001)).toBe("uno milione uno");
		});
		it("should convert 987654321 (default)", () => {
			expect(toWords.numberToWords(987654321)).toBe(
				"nove cento ottanta sette milioni sei cento cinquanta quattro mille tre cento venti uno",
			);
		});
		it("should convert 1000000000000000 (default)", () => {
			expect(toWords.numberToWords(1000000000000000)).toBe("uno biliardo");
		});
		it("should convert 1040000560007081 (default)", () => {
			expect(toWords.numberToWords(1040000560007081)).toBe(
				"uno biliardo quaranta bilioni cinque cento sessanta milioni sette mille ottanta uno",
			);
		});
		it("should convert 12.34 (default)", () => {
			expect(toWords.numberToWords(12.34)).toBe(
				"dodici virgola trenta quattro",
			);
		});
		it("should convert 10.05 (default)", () => {
			expect(toWords.numberToWords(10.05)).toBe("dieci virgola zero cinque");
		});
		it("should convert 0.5 (default)", () => {
			expect(toWords.numberToWords(0.5)).toBe("zero virgola cinque");
		});
		it("should convert -50 (default)", () => {
			expect(toWords.numberToWords(-50)).toBe("meno cinquanta");
		});
		it("should convert -0.5 (default)", () => {
			expect(toWords.numberToWords(-0.5)).toBe("meno zero virgola cinque");
		});
		it("should convert 0.005 (default)", () => {
			expect(toWords.numberToWords(0.005)).toBe(
				"zero virgola zero zero cinque",
			);
		});
	});

	// Country defaults
	describe("it-IT", () => {
		const toWords = new ToWords({ locale: "it-IT" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("it (International)");
		});
		it("should use default currency (EUR)", () => {
			expect(toWords.numberToCurrency(1)).toBe("uno euro solo");
		});
	});

	describe("it-CH", () => {
		const toWords = new ToWords({ locale: "it-CH" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("it (International)");
		});
		it("should use default currency (CHF)", () => {
			expect(toWords.numberToCurrency(1)).toBe("uno franco solo");
		});
	});
});
