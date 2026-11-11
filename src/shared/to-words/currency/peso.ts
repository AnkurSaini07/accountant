import type { CurrencyUnit } from "../types";

export const peso: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "peso" : "pesos"),
		fractional: (count) => (count === 1 ? "centavo" : "centavos"),
	},
	es: {
		main: (count) => (count === 1 ? "peso" : "pesos"),
		fractional: (count) => (count === 1 ? "centavo" : "centavos"),
	},
	hi: {
		main: () => "पेसो",
		fractional: () => "सेंटावो",
	},
	de: { main: () => "Peso", fractional: () => "Centavo" },
	fr: { main: () => "peso", fractional: () => "centavo" },
	it: { main: () => "peso", fractional: () => "centavo" },
	nl: { main: () => "peso", fractional: () => "centavo" },
	pt: { main: () => "peso", fractional: () => "centavo" },
	ja: { main: () => "ペソ", fractional: () => "センターボ" },
	zh: { main: () => "比索", fractional: () => "分" },
	id: { main: () => "peso", fractional: () => "centavo" },
	ru: {
		main: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "песо";
			}
			return "песо"; // Peso is generally indeclinable or "песо" in RU plural? Checking... "5 песо". Invariant.
		},
		fractional: () => "сентаво",
	},
};
