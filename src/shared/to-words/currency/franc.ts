import type { CurrencyUnit } from "../types";

export const franc: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "franc" : "francs"),
		fractional: (count) => (count === 1 ? "centime" : "centimes"),
	},
	fr: {
		main: (count) => (count === 1 ? "franc" : "francs"),
		fractional: (count) => (count === 1 ? "centime" : "centimes"),
	},
	de: {
		main: () => "Franken",
		fractional: () => "Rappen", // Swiss German uses Rappen
	},
	it: {
		main: (count) => (count === 1 ? "franco" : "franchi"),
		fractional: (count) => (count === 1 ? "centesimo" : "centesimi"),
	},
	hi: {
		main: () => "फ्रैंक",
		fractional: () => "सेंटाइम",
	},
	es: {
		main: (count) => (count === 1 ? "franco" : "francos"),
		fractional: (count) => (count === 1 ? "céntimo" : "céntimos"),
	},
	nl: { main: () => "frank", fractional: () => "centiem" },
	pt: {
		main: (count) => (count === 1 ? "franco" : "francos"),
		fractional: (count) => (count === 1 ? "cêntimo" : "cêntimos"),
	},
	ja: { main: () => "フラン", fractional: () => "サンチーム" },
	zh: { main: () => "法郎", fractional: () => "分" },
	id: { main: () => "franc", fractional: () => "centime" },
	ru: {
		main: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "франк";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "франка";
			}
			return "франков";
		},
		fractional: () => "сантим",
	},
};
