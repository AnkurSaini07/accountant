import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("DE Tests", () => {
	// Base language
	describe("de", () => {
		const toWords = new ToWords({ locale: "de" });

		it("should return supported systems", () => {
			expect(toWords.getSupportedSystems()).toEqual(["de (International)"]);
		});

		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("de (International)");
		});

		it("should convert 1234567 (default)", () => {
			expect(toWords.numberToWords(1234567)).toBe(
				"eins Million zwei hundert dreißig vier tausend fünf hundert sechzig sieben",
			);
		});
		it("should convert 1000001 (default)", () => {
			expect(toWords.numberToWords(1000001)).toBe("eins Million eins");
		});
		it("should convert 987654321 (default)", () => {
			expect(toWords.numberToWords(987654321)).toBe(
				"neun hundert achtzig sieben Millionen sechs hundert fünfzig vier tausend drei hundert zwanzig eins",
			);
		});
		it("should convert 1000000000000000 (default)", () => {
			expect(toWords.numberToWords(1000000000000000)).toBe("eins Billiarde");
		});
		it("should convert 1040000560007081 (default)", () => {
			expect(toWords.numberToWords(1040000560007081)).toBe(
				"eins Billiarde vierzig Billionen fünf hundert sechzig Millionen sieben tausend achtzig eins",
			);
		});
		it("should convert 12.34 (default)", () => {
			expect(toWords.numberToWords(12.34)).toBe("zwölf komma dreißig vier");
		});
		it("should convert 10.05 (default)", () => {
			expect(toWords.numberToWords(10.05)).toBe("zehn komma null fünf");
		});
		it("should convert 0.5 (default)", () => {
			expect(toWords.numberToWords(0.5)).toBe("null komma fünf");
		});
		it("should convert -50 (default)", () => {
			expect(toWords.numberToWords(-50)).toBe("minus fünfzig");
		});
		it("should convert -0.5 (default)", () => {
			expect(toWords.numberToWords(-0.5)).toBe("minus null komma fünf");
		});
		it("should convert 0.005 (default)", () => {
			expect(toWords.numberToWords(0.005)).toBe("null komma null null fünf");
		});
	});

	// Country defaults
	describe("de-DE", () => {
		const toWords = new ToWords({ locale: "de-DE" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("de (International)");
		});
		it("should use default currency (EUR)", () => {
			expect(toWords.numberToCurrency(1)).toBe("eins Euro nur");
		});
	});

	describe("de-CH", () => {
		const toWords = new ToWords({ locale: "de-CH" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("de (International)");
		});
		it("should use default currency (CHF)", () => {
			expect(toWords.numberToCurrency(1)).toBe("eins Franken nur");
		});
	});
});
