import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("FR Tests", () => {
	// Base language
	describe("fr", () => {
		const toWords = new ToWords({ locale: "fr" });

		it("should return supported systems", () => {
			expect(toWords.getSupportedSystems()).toEqual(["fr (International)"]);
		});

		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("fr (International)");
		});

		it("should convert 1234567 (default)", () => {
			expect(toWords.numberToWords(1234567)).toBe(
				"un million deux cent trente quatre mille cinq cent soixante sept",
			);
		});
		it("should convert 1000001 (default)", () => {
			expect(toWords.numberToWords(1000001)).toBe("un million un");
		});
		it("should convert 987654321 (default)", () => {
			expect(toWords.numberToWords(987654321)).toBe(
				"neuf cent quatre-vingts sept millions six cent cinquante quatre mille trois cent vingt un",
			);
		});
		it("should convert 1000000000000000 (default)", () => {
			expect(toWords.numberToWords(1000000000000000)).toBe("un billiard");
		});
		it("should convert 1040000560007081 (default)", () => {
			expect(toWords.numberToWords(1040000560007081)).toBe(
				"un billiard quarante billions cinq cent soixante millions sept mille quatre-vingts un",
			);
		});
		it("should convert 12.34 (default)", () => {
			expect(toWords.numberToWords(12.34)).toBe("douze virgule trente quatre");
		});
		it("should convert 10.05 (default)", () => {
			expect(toWords.numberToWords(10.05)).toBe("dix virgule zéro cinq");
		});
		it("should convert 0.5 (default)", () => {
			expect(toWords.numberToWords(0.5)).toBe("zéro virgule cinq");
		});
		it("should convert -50 (default)", () => {
			expect(toWords.numberToWords(-50)).toBe("moins cinquante");
		});
		it("should convert -0.5 (default)", () => {
			expect(toWords.numberToWords(-0.5)).toBe("moins zéro virgule cinq");
		});
		it("should convert 0.005 (default)", () => {
			expect(toWords.numberToWords(0.005)).toBe("zéro virgule zéro zéro cinq");
		});
	});

	// Country defaults
	describe("fr-FR", () => {
		const toWords = new ToWords({ locale: "fr-FR" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("fr (International)");
		});
		it("should use default currency (EUR)", () => {
			expect(toWords.numberToCurrency(1)).toBe("un euro seulement");
		});
	});

	describe("fr-CA", () => {
		const toWords = new ToWords({ locale: "fr-CA" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("fr (International)");
		});
		it("should use default currency (CAD)", () => {
			expect(toWords.numberToCurrency(1)).toBe("un dollar seulement");
		});
	});

	describe("fr-CH", () => {
		const toWords = new ToWords({ locale: "fr-CH" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("fr (International)");
		});
		it("should use default currency (CHF)", () => {
			expect(toWords.numberToCurrency(1)).toBe("un franc seulement");
		});
	});
});
