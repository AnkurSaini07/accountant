import type { CurrencyUnit } from "../types";

export const rupiah: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "rupiah" : "rupiahs"),
		fractional: (count) => (count === 1 ? "sen" : "sen"),
	},
	id: {
		main: () => "rupiah",
		fractional: () => "sen",
	},
	hi: {
		main: () => "रुपिया",
		fractional: () => "सेन",
	},
	de: {
		main: () => "Rupiah",
		fractional: () => "Sen",
	},
	fr: {
		main: () => "roupie",
		fractional: () => "sen",
	},
	es: {
		main: () => "rupia",
		fractional: () => "sen",
	},
	it: {
		main: () => "rupia",
		fractional: () => "sen",
	},
	nl: {
		main: () => "roepia",
		fractional: () => "sen",
	},
	pt: {
		main: () => "rupia",
		fractional: () => "sen",
	},
	ja: {
		main: () => "ルピア",
		fractional: () => "セン",
	},
	zh: {
		main: () => "卢比",
		fractional: () => "仙",
	},
	ru: {
		main: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "рупия";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "рупии";
			}
			return "рупий";
		},
		fractional: () => "сен",
	},
};
