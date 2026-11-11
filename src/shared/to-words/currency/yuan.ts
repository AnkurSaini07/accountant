import type { CurrencyUnit } from "../types";

export const yuan: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "yuan" : "yuan"),
		fractional: (count) => (count === 1 ? "fen" : "fen"),
	},
	zh: {
		main: () => "元",
		fractional: () => "分",
	},
	hi: {
		main: () => "युआन",
		fractional: () => "फेन",
	},
	de: {
		main: () => "Yuan",
		fractional: () => "Fen",
	},
	fr: {
		main: () => "yuan",
		fractional: () => "fen",
	},
	es: {
		main: () => "yuan",
		fractional: () => "fen",
	},
	it: {
		main: () => "yuan",
		fractional: () => "fen",
	},
	nl: {
		main: () => "yuan",
		fractional: () => "fen",
	},
	pt: {
		main: () => "yuan",
		fractional: () => "fen",
	},
	ja: {
		main: () => "元",
		fractional: () => "分",
	},
	ru: {
		main: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "юань";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "юаня";
			}
			return "юаней";
		},
		fractional: () => "фэнь",
	},
	id: {
		main: () => "yuan",
		fractional: () => "fen",
	},
};
