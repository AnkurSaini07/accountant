import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("ZH Tests", () => {
	// Base language
	describe("zh", () => {
		const toWords = new ToWords({ locale: "zh" });

		it("should return supported systems", () => {
			expect(toWords.getSupportedSystems()).toEqual(["zh (East Asian)"]);
		});

		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("zh (East Asian)");
		});

		it("should convert 1234567 (default)", () => {
			expect(toWords.numberToWords(1234567)).toBe(
				"一 佰 二十 三 萬 四 仟 五 佰 六十 七",
			);
		});
		it("should convert 1000001 (default)", () => {
			expect(toWords.numberToWords(1000001)).toBe("一 佰 萬 一");
		});
		it("should convert 987654321 (default)", () => {
			expect(toWords.numberToWords(987654321)).toBe(
				"九 億 八 仟 七 佰 六十 五 萬 四 仟 三 佰 二十 一",
			);
		});
		it("should convert 1000000000000000 (default)", () => {
			expect(toWords.numberToWords(1000000000000000)).toBe("一 京");
		});
		it("should convert 1040000560007081 (default)", () => {
			expect(toWords.numberToWords(1040000560007081)).toBe(
				"一 京 四十 兆 五 億 六 仟 萬 七 仟 八十 一",
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
			expect(toWords.numberToWords(-50)).toBe("负 五十");
		});
		it("should convert -0.5 (default)", () => {
			expect(toWords.numberToWords(-0.5)).toBe("负 零 点 五");
		});
		it("should convert 0.005 (default)", () => {
			expect(toWords.numberToWords(0.005)).toBe("零 点 零 零 五");
		});
	});

	// Country defaults
	describe("zh-CN", () => {
		const toWords = new ToWords({ locale: "zh-CN" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("zh (East Asian)");
		});
		it("should use default currency (CNY)", () => {
			expect(toWords.numberToCurrency(1)).toBe("一 元 整");
		});
	});
});
