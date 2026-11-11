import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("ID Tests", () => {
	// Base language
	describe("id", () => {
		const toWords = new ToWords({ locale: "id" });

		it("should return supported systems", () => {
			expect(toWords.getSupportedSystems()).toEqual(["id (International)"]);
		});

		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("id (International)");
		});

		it("should convert 1234567 (default)", () => {
			expect(toWords.numberToWords(1234567)).toBe(
				"satu juta dua ratus tiga puluh empat ribu lima ratus enam puluh tujuh",
			);
		});
		it("should convert 1000001 (default)", () => {
			expect(toWords.numberToWords(1000001)).toBe("satu juta satu");
		});
		it("should convert 987654321 (default)", () => {
			expect(toWords.numberToWords(987654321)).toBe(
				"sembilan ratus delapan puluh tujuh juta enam ratus lima puluh empat ribu tiga ratus dua puluh satu",
			);
		});
		it("should convert 1000000000000000 (default)", () => {
			expect(toWords.numberToWords(1000000000000000)).toBe("satu kuadriliun");
		});
		it("should convert 1040000560007081 (default)", () => {
			expect(toWords.numberToWords(1040000560007081)).toBe(
				"satu kuadriliun empat puluh triliun lima ratus enam puluh juta tujuh ribu delapan puluh satu",
			);
		});
		it("should convert 12.34 (default)", () => {
			expect(toWords.numberToWords(12.34)).toBe(
				"dua belas koma tiga puluh empat",
			);
		});
		it("should convert 10.05 (default)", () => {
			expect(toWords.numberToWords(10.05)).toBe("sepuluh koma nol lima");
		});
		it("should convert 0.5 (default)", () => {
			expect(toWords.numberToWords(0.5)).toBe("nol koma lima");
		});
		it("should convert -50 (default)", () => {
			expect(toWords.numberToWords(-50)).toBe("minus lima puluh");
		});
		it("should convert -0.5 (default)", () => {
			expect(toWords.numberToWords(-0.5)).toBe("minus nol koma lima");
		});
		it("should convert 0.005 (default)", () => {
			expect(toWords.numberToWords(0.005)).toBe("nol koma nol nol lima");
		});
	});

	// Country defaults
	describe("id-ID", () => {
		const toWords = new ToWords({ locale: "id-ID" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("id (International)");
		});
		it("should use default currency (IDR)", () => {
			expect(toWords.numberToCurrency(1)).toBe("satu rupiah saja");
		});
	});
});
