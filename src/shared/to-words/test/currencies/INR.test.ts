import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("INR Currency Tests", () => {
	describe("en", () => {
		const toWords = new ToWords({ locale: "en" });
		it("should convert to INR", () => {
			expect(toWords.numberToCurrency(1, { currency: "INR" })).toBe(
				"one rupee only",
			);
			expect(toWords.numberToCurrency(2, { currency: "INR" })).toBe(
				"two rupees only",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "INR" })).toBe(
				"one rupee and one paisa",
			);
		});
	});

	describe("hi", () => {
		const toWords = new ToWords({ locale: "hi" });
		it("should convert to INR", () => {
			expect(toWords.numberToCurrency(1, { currency: "INR" })).toBe(
				"एक रुपया मात्र",
			);
			expect(toWords.numberToCurrency(2, { currency: "INR" })).toBe(
				"दो रुपये मात्र",
			);
			expect(toWords.numberToCurrency(1.01, { currency: "INR" })).toBe(
				"एक रुपया और एक पैसा",
			);
		});
	});
});
