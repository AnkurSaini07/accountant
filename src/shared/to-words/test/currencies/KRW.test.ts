import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("KRW Currency Tests", () => {
	describe("en", () => {
		const toWords = new ToWords({ locale: "en" });
		it("should convert to KRW", () => {
			expect(toWords.numberToCurrency(1, { currency: "KRW" })).toBe(
				"one won only",
			);
		});
	});
});
