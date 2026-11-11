import { describe, expect, it } from "bun:test";
import { ToWords } from "../../to-words";

describe("EN Tests", () => {
	// Base language test
	describe("en", () => {
		const toWords = new ToWords({ locale: "en" });

		it("should return supported systems", () => {
			expect(toWords.getSupportedSystems()).toEqual([
				"en (Indian)",
				"en (International)",
			]);
		});

		// Default should be International for generic 'en'
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (International)");
		});

		it("should convert 1234567 (default)", () => {
			expect(toWords.numberToWords(1234567)).toBe(
				"one million two hundred thirty four thousand five hundred sixty seven",
			);
		});
		it("should convert 1000001 (default)", () => {
			expect(toWords.numberToWords(1000001)).toBe("one million one");
		});
		it("should convert 987654321 (default)", () => {
			expect(toWords.numberToWords(987654321)).toBe(
				"nine hundred eighty seven million six hundred fifty four thousand three hundred twenty one",
			);
		});
		it("should convert 1000000000000000 (default)", () => {
			expect(toWords.numberToWords(1000000000000000)).toBe("one quadrillion");
		});
		it("should convert 1040000560007081 (default)", () => {
			expect(toWords.numberToWords(1040000560007081)).toBe(
				"one quadrillion forty trillion five hundred sixty million seven thousand eighty one",
			);
		});
		it("should convert 12.34 (default)", () => {
			expect(toWords.numberToWords(12.34)).toBe("twelve point thirty four");
		});
		it("should convert 10.05 (default)", () => {
			expect(toWords.numberToWords(10.05)).toBe("ten point zero five");
		});
		it("should convert 0.5 (default)", () => {
			expect(toWords.numberToWords(0.5)).toBe("zero point five");
		});
		it("should convert -50 (default)", () => {
			expect(toWords.numberToWords(-50)).toBe("minus fifty");
		});
		it("should convert -0.5 (default)", () => {
			expect(toWords.numberToWords(-0.5)).toBe("minus zero point five");
		});
		it("should convert 0.005 (default)", () => {
			expect(toWords.numberToWords(0.005)).toBe("zero point zero zero five");
		});

		// Test explicit systems
		it("should convert 1234567 with systemId 'en (International)'", () => {
			expect(
				toWords.numberToWords(1234567, { systemId: "en (International)" }),
			).toBe(
				"one million two hundred thirty four thousand five hundred sixty seven",
			);
		});

		it("should convert 1234567 with systemId 'en (Indian)'", () => {
			expect(toWords.numberToWords(1234567, { systemId: "en (Indian)" })).toBe(
				"twelve lakh thirty four thousand five hundred sixty seven",
			);
		});

		it("should convert 1000001 (en (Indian))", () => {
			expect(toWords.numberToWords(1000001, { systemId: "en (Indian)" })).toBe(
				"ten lakh one",
			);
		});
		it("should convert 987654321 (en (Indian))", () => {
			expect(
				toWords.numberToWords(987654321, { systemId: "en (Indian)" }),
			).toBe(
				"ninety eight crore seventy six lakh fifty four thousand three hundred twenty one",
			);
		});
		it("should convert 1000000000000000 (en (Indian))", () => {
			expect(
				toWords.numberToWords(1000000000000000, { systemId: "en (Indian)" }),
			).toBe("ten thousand kharab");
		});
		it("should convert 1040000560007081 (en (Indian))", () => {
			expect(
				toWords.numberToWords(1040000560007081, { systemId: "en (Indian)" }),
			).toBe(
				"ten thousand four hundred kharab fifty six crore seven thousand eighty one",
			);
		});
	});

	// Country checks for defaults
	describe("en-US", () => {
		const toWords = new ToWords({ locale: "en-US" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (International)");
		});
		it("should use default currency (USD)", () => {
			expect(toWords.numberToCurrency(1)).toBe("one dollar only");
		});
	});

	describe("en-GB", () => {
		const toWords = new ToWords({ locale: "en-GB" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (International)");
		});
		it("should use default currency (GBP)", () => {
			expect(toWords.numberToCurrency(1)).toBe("one pound only");
		});
	});

	describe("en-AU", () => {
		const toWords = new ToWords({ locale: "en-AU" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (International)");
		});
		it("should use default currency (AUD)", () => {
			// AUD uses Dollar
			expect(toWords.numberToCurrency(1)).toBe("one dollar only");
		});
	});

	describe("en-NZ", () => {
		const toWords = new ToWords({ locale: "en-NZ" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (International)");
		});
		it("should use default currency (NZD)", () => {
			// NZD uses Dollar
			expect(toWords.numberToCurrency(1)).toBe("one dollar only");
		});
	});

	describe("en-CA", () => {
		const toWords = new ToWords({ locale: "en-CA" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (International)");
		});
		it("should use default currency (CAD)", () => {
			expect(toWords.numberToCurrency(1)).toBe("one dollar only");
		});
	});

	describe("en-IN", () => {
		const toWords = new ToWords({ locale: "en-IN" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (Indian)");
		});
		it("should support both systems", () => {
			expect(toWords.getSupportedSystems()).toEqual([
				"en (Indian)",
				"en (International)",
			]);
		});
		it("should use default currency (INR)", () => {
			expect(toWords.numberToCurrency(1)).toBe("one rupee only");
		});
	});

	describe("en-IE", () => {
		const toWords = new ToWords({ locale: "en-IE" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (International)");
		});
		it("should use default currency (EUR)", () => {
			expect(toWords.numberToCurrency(1)).toBe("one euro only");
		});
	});

	// en-ZA (ZAR) not supported yet
	/*
    describe("en-ZA", () => {
        const toWords = new ToWords({ locale: "en-ZA" });
        it("should return default system", () => {
            expect(toWords.getDefaultSystemId()).toBe("en (International)");
        });
        it("should use default currency (ZAR)", () => {
             expect(toWords.numberToCurrency(1)).toBe("one rand only");
        });
    });
    */

	describe("en-PH", () => {
		const toWords = new ToWords({ locale: "en-PH" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (International)");
		});
		it("should use default currency (PHP)", () => {
			expect(toWords.numberToCurrency(1)).toBe("one peso only");
		});
	});

	describe("en-SG", () => {
		const toWords = new ToWords({ locale: "en-SG" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (International)");
		});
		it("should use default currency (SGD)", () => {
			expect(toWords.numberToCurrency(1)).toBe("one dollar only");
		});
	});

	// en-GH (GHS) not supported yet
	/*
    describe("en-GH", () => {
        const toWords = new ToWords({ locale: "en-GH" });
        it("should return default system", () => {
            expect(toWords.getDefaultSystemId()).toBe("en (International)");
        });
        it("should use default currency (GHS)", () => {
             expect(toWords.numberToCurrency(1)).toBe("one cedi Only");
        });
    });
    */

	// en-NG (NGN) not supported yet
	/*
    describe("en-NG", () => {
        const toWords = new ToWords({ locale: "en-NG" });
        it("should return default system", () => {
            expect(toWords.getDefaultSystemId()).toBe("en (International)");
        });
        it("should use default currency (NGN)", () => {
             expect(toWords.numberToCurrency(1)).toBe("one naira Only");
        });
    });
    */

	describe("en-PK", () => {
		const toWords = new ToWords({ locale: "en-PK" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (Indian)");
		});
		it("should use default currency (PKR)", () => {
			expect(toWords.numberToCurrency(1)).toBe("one rupee only");
		});
	});

	describe("en-NP", () => {
		const toWords = new ToWords({ locale: "en-NP" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (Indian)");
		});
		it("should use default currency (NPR)", () => {
			expect(toWords.numberToCurrency(1)).toBe("one rupee only");
		});
	});

	describe("en-BD", () => {
		const toWords = new ToWords({ locale: "en-BD" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (Indian)");
		});
	});

	describe("en-LK", () => {
		const toWords = new ToWords({ locale: "en-LK" });
		it("should return default system", () => {
			expect(toWords.getDefaultSystemId()).toBe("en (Indian)");
		});
		it("should use default currency (LKR)", () => {
			expect(toWords.numberToCurrency(1)).toBe("one rupee only");
		});
	});
});
