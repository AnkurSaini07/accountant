import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("NL Tests", () => {
	// Base language
	describe("nl", () => {
		const toWords = new ToWords({ locale: "nl" });

		it("should return supported systems", () => {
			expect(toWords.getSupportedSystems()).toEqual(["nl (International)"]);
		});

		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("nl (International)");
		});

		it("should convert 1234567 (default)", () => {
			expect(toWords.numberToWords(1234567)).toBe(
				"een miljoen twee honderd dertig vier duizend vijf honderd zestig zeven",
			);
		});
		it("should convert 1000001 (default)", () => {
			expect(toWords.numberToWords(1000001)).toBe("een miljoen een");
		});
		it("should convert 987654321 (default)", () => {
			expect(toWords.numberToWords(987654321)).toBe(
				"negen honderd tachtig zeven miljoenen zes honderd vijftig vier duizend drie honderd twintig een",
			);
		});
		it("should convert 1000000000000000 (default)", () => {
			expect(toWords.numberToWords(1000000000000000)).toBe("een biljard");
		});
		it("should convert 1040000560007081 (default)", () => {
			expect(toWords.numberToWords(1040000560007081)).toBe(
				"een biljard veertig biljoenen vijf honderd zestig miljoenen zeven duizend tachtig een",
			);
		});
		it("should convert 12.34 (default)", () => {
			expect(toWords.numberToWords(12.34)).toBe("twaalf komma dertig vier");
		});
		it("should convert 10.05 (default)", () => {
			expect(toWords.numberToWords(10.05)).toBe("tien komma nul vijf");
		});
		it("should convert 0.5 (default)", () => {
			expect(toWords.numberToWords(0.5)).toBe("nul komma vijf");
		});
		it("should convert -50 (default)", () => {
			expect(toWords.numberToWords(-50)).toBe("min vijftig");
		});
		it("should convert -0.5 (default)", () => {
			expect(toWords.numberToWords(-0.5)).toBe("min nul komma vijf");
		});
		it("should convert 0.005 (default)", () => {
			expect(toWords.numberToWords(0.005)).toBe("nul komma nul nul vijf");
		});
	});

	// Country defaults
	describe("nl-NL", () => {
		const toWords = new ToWords({ locale: "nl-NL" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("nl (International)");
		});
		it("should use default currency (EUR)", () => {
			expect(toWords.numberToCurrency(1)).toBe("een euro alleen");
		});
	});
});
