import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("PT Tests", () => {
	// Base language (pt) -> Defaults to pt (International)
	describe("pt", () => {
		const toWords = new ToWords({ locale: "pt" });

		it("should return supported systems", () => {
			expect(toWords.getSupportedSystems()).toEqual(["pt (International)"]);
		});

		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("pt (International)");
		});

		it("should convert 1234567 (default)", () => {
			expect(toWords.numberToWords(1234567)).toBe(
				"um milhão dois cem trinta quatro mil cinco cem sessenta sete",
			);
		});
		it("should convert 1000001 (default)", () => {
			expect(toWords.numberToWords(1000001)).toBe("um milhão um");
		});
		it("should convert 987654321 (default)", () => {
			expect(toWords.numberToWords(987654321)).toBe(
				"nove cem oitenta sete milhões seis cem cinquenta quatro mil três cem vinte um",
			);
		});
		it("should convert 1000000000000000 (default)", () => {
			expect(toWords.numberToWords(1000000000000000)).toBe("um quatrilhão");
		});
		it("should convert 1040000560007081 (default)", () => {
			expect(toWords.numberToWords(1040000560007081)).toBe(
				"um quatrilhão quarenta trilhões cinco cem sessenta milhões sete mil oitenta um",
			);
		});
		it("should convert 12.34 (default)", () => {
			expect(toWords.numberToWords(12.34)).toBe("doze vírgula trinta quatro");
		});
		it("should convert 10.05 (default)", () => {
			expect(toWords.numberToWords(10.05)).toBe("dez vírgula zero cinco");
		});
		it("should convert 0.5 (default)", () => {
			expect(toWords.numberToWords(0.5)).toBe("zero vírgula cinco");
		});
		it("should convert -50 (default)", () => {
			expect(toWords.numberToWords(-50)).toBe("menos cinquenta");
		});
		it("should convert -0.5 (default)", () => {
			expect(toWords.numberToWords(-0.5)).toBe("menos zero vírgula cinco");
		});
		it("should convert 0.005 (default)", () => {
			expect(toWords.numberToWords(0.005)).toBe("zero vírgula zero zero cinco");
		});
	});

	// Base language variant (pt-PT) -> Defaults to pt-PT (International)
	describe("pt-PT", () => {
		const toWords = new ToWords({ locale: "pt-PT" });

		it("should return supported systems", () => {
			expect(toWords.getSupportedSystems()).toEqual(["pt-PT (International)"]);
		});

		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("pt-PT (International)");
		});

		it("should convert 1234567 (default)", () => {
			expect(toWords.numberToWords(1234567)).toBe(
				"um milhão dois cem trinta quatro mil cinco cem sessenta sete",
			);
		});
		it("should convert 1000000000000000 (default)", () => {
			expect(toWords.numberToWords(1000000000000000)).toBe("um biliardo");
		});
		it("should convert 1040000560007081 (default)", () => {
			expect(toWords.numberToWords(1040000560007081)).toBe(
				"um biliardo quarenta biliões cinco cem sessenta milhões sete mil oitenta um",
			);
		});

		it("should use default currency (EUR)", () => {
			expect(toWords.numberToCurrency(1)).toBe("um euro apenas");
		});
	});

	// Country defaults
	describe("pt-BR", () => {
		const toWords = new ToWords({ locale: "pt-BR" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("pt (International)");
		});
		it("should use default currency (BRL)", () => {
			expect(toWords.numberToCurrency(1)).toBe("um real apenas");
		});
	});
});
