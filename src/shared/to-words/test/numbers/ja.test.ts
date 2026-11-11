import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("JA Tests", () => {
	// Base language
	describe("ja", () => {
		const toWords = new ToWords({ locale: "ja" });

		it("should return supported systems", () => {
			expect(toWords.getSupportedSystems()).toEqual(["ja (East Asian)"]);
		});

		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("ja (East Asian)");
		});

		it("should convert 1234567 (default)", () => {
			expect(toWords.numberToWords(1234567)).toBe(
				"一 百 二十 三 萬 四 千 五 百 六十 七",
			);
		});
		it("should convert 1000001 (default)", () => {
			expect(toWords.numberToWords(1000001)).toBe("一 百 萬 一");
		});
		it("should convert 987654321 (default)", () => {
			expect(toWords.numberToWords(987654321)).toBe(
				"九 億 八 千 七 百 六十 五 萬 四 千 三 百 二十 一",
			);
		});
		it("should convert 1000000000000000 (default)", () => {
			expect(toWords.numberToWords(1000000000000000)).toBe("一 京");
		});
		it("should convert 1040000560007081 (default)", () => {
			expect(toWords.numberToWords(1040000560007081)).toBe(
				"一 京 四十 兆 五 億 六 千 萬 七 千 八十 一",
			);
		});
		it("should convert 12.34 (default)", () => {
			expect(toWords.numberToWords(12.34)).toBe("十二 点 三十 四");
		});
		it("should convert 10.05 (default)", () => {
			expect(toWords.numberToWords(10.05)).toBe("十 点 零 五");
		});
		it("should convert 0.5 (default)", () => {
			expect(toWords.numberToWords(0.5)).toBe("零 点 五");
		});
		it("should convert -50 (default)", () => {
			expect(toWords.numberToWords(-50)).toBe("マイナス 五十");
		});
		it("should convert -0.5 (default)", () => {
			expect(toWords.numberToWords(-0.5)).toBe("マイナス 零 点 五");
		});
		it("should convert 0.005 (default)", () => {
			expect(toWords.numberToWords(0.005)).toBe("零 点 零 零 五");
		});
	});

	// Country defaults
	describe("ja-JP", () => {
		const toWords = new ToWords({ locale: "ja-JP" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("ja (East Asian)");
		});
		it("should use default currency (JPY)", () => {
			expect(toWords.numberToCurrency(1)).toBe("一 円 のみ");
		});
	});
});
