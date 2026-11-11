import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("RU Tests", () => {
	// Base language
	describe("ru", () => {
		const toWords = new ToWords({ locale: "ru" });

		it("should return supported systems", () => {
			expect(toWords.getSupportedSystems()).toEqual(["ru (International)"]);
		});

		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("ru (International)");
		});

		it("should convert 1234567 (default)", () => {
			expect(toWords.numberToWords(1234567)).toBe(
				"один Миллион два Сто тридцать четыре Тысяч пять Сто шестьдесят семь",
			);
		});
		it("should convert 1000001 (default)", () => {
			expect(toWords.numberToWords(1000001)).toBe("один Миллион один");
		});
		it("should convert 987654321 (default)", () => {
			expect(toWords.numberToWords(987654321)).toBe(
				"девять Сто восемьдесят семь Миллиона шесть Сто пятьдесят четыре Тысяч три Сто двадцать один",
			);
		});
		it("should convert 1000000000000000 (default)", () => {
			expect(toWords.numberToWords(1000000000000000)).toBe("один Квадриллион");
		});
		it("should convert 1040000560007081 (default)", () => {
			expect(toWords.numberToWords(1040000560007081)).toBe(
				"один Квадриллион сорок Триллиона пять Сто шестьдесят Миллиона семь Тысяч восемьдесят один",
			);
		});
		it("should convert 12.34 (default)", () => {
			expect(toWords.numberToWords(12.34)).toBe(
				"двенадцать запятая тридцать четыре",
			);
		});
		it("should convert 10.05 (default)", () => {
			expect(toWords.numberToWords(10.05)).toBe("десять запятая ноль пять");
		});
		it("should convert 0.5 (default)", () => {
			expect(toWords.numberToWords(0.5)).toBe("ноль запятая пять");
		});
		it("should convert -50 (default)", () => {
			expect(toWords.numberToWords(-50)).toBe("минус пятьдесят");
		});
		it("should convert -0.5 (default)", () => {
			expect(toWords.numberToWords(-0.5)).toBe("минус ноль запятая пять");
		});
		it("should convert 0.005 (default)", () => {
			expect(toWords.numberToWords(0.005)).toBe("ноль запятая ноль ноль пять");
		});
	});

	// Country defaults
	describe("ru-RU", () => {
		const toWords = new ToWords({ locale: "ru-RU" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("ru (International)");
		});
		it("should use default currency (RUB)", () => {
			expect(toWords.numberToCurrency(1)).toBe("один рубль только");
		});
	});
});
