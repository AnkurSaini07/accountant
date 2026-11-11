import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("ES Tests", () => {
	// Base language
	describe("es", () => {
		const toWords = new ToWords({ locale: "es" });

		it("should return supported systems", () => {
			expect(toWords.getSupportedSystems()).toEqual(["es (International)"]);
		});

		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("es (International)");
		});

		it("should convert 1234567 (default)", () => {
			expect(toWords.numberToWords(1234567)).toBe(
				"uno millón dos cien treinta cuatro mil cinco cien sesenta siete",
			);
		});
		it("should convert 1000001 (default)", () => {
			expect(toWords.numberToWords(1000001)).toBe("uno millón uno");
		});
		it("should convert 987654321 (default)", () => {
			expect(toWords.numberToWords(987654321)).toBe(
				"nueve cien ochenta siete millones seis cien cincuenta cuatro mil tres cien veinte uno",
			);
		});
		it("should convert 1000000000000000 (default)", () => {
			expect(toWords.numberToWords(1000000000000000)).toBe("uno billardo");
		});
		it("should convert 1040000560007081 (default)", () => {
			expect(toWords.numberToWords(1040000560007081)).toBe(
				"uno billardo cuarenta billones cinco cien sesenta millones siete mil ochenta uno",
			);
		});
		it("should convert 12.34 (default)", () => {
			expect(toWords.numberToWords(12.34)).toBe("doce coma treinta cuatro");
		});
		it("should convert 10.05 (default)", () => {
			expect(toWords.numberToWords(10.05)).toBe("diez coma cero cinco");
		});
		it("should convert 0.5 (default)", () => {
			expect(toWords.numberToWords(0.5)).toBe("cero coma cinco");
		});
		it("should convert -50 (default)", () => {
			expect(toWords.numberToWords(-50)).toBe("menos cincuenta");
		});
		it("should convert -0.5 (default)", () => {
			expect(toWords.numberToWords(-0.5)).toBe("menos cero coma cinco");
		});
		it("should convert 0.005 (default)", () => {
			expect(toWords.numberToWords(0.005)).toBe("cero coma cero cero cinco");
		});
	});

	// Country defaults
	describe("es-ES", () => {
		const toWords = new ToWords({ locale: "es-ES" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("es (International)");
		});
		it("should use default currency (EUR)", () => {
			expect(toWords.numberToCurrency(1)).toBe("uno euro solamente");
		});
	});

	describe("es-MX", () => {
		const toWords = new ToWords({ locale: "es-MX" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("es (International)");
		});
		it("should use default currency (MXN)", () => {
			expect(toWords.numberToCurrency(1)).toBe("uno peso solamente");
		});
	});

	describe("es-AR", () => {
		const toWords = new ToWords({ locale: "es-AR" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("es (International)");
		});
		it("should use default currency (ARS)", () => {
			expect(toWords.numberToCurrency(1)).toBe("uno peso solamente");
		});
	});
});
