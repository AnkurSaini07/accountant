import type { CurrencyUnit } from "../types";

export const rupee: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "rupee" : "rupees"),
		fractional: (count) => (count === 1 ? "paisa" : "paise"),
	},
	hi: {
		main: (count) => (count === 1 ? "रुपया" : "रुपये"),
		fractional: (count) => (count === 1 ? "पैसा" : "पैसे"),
	},
	de: {
		main: () => "Rupie",
		fractional: () => "Paisa",
	},
	fr: {
		main: (count) => (count === 1 ? "roupie" : "roupies"),
		fractional: (count) => (count === 1 ? "paisa" : "paise"),
	},
	es: {
		main: (count) => (count === 1 ? "rupia" : "rupias"),
		fractional: (count) => (count === 1 ? "paisa" : "paise"),
	},
	it: {
		main: (count) => (count === 1 ? "rupia" : "rupie"),
		fractional: (count) => (count === 1 ? "paisa" : "paise"),
	},
	nl: {
		main: () => "roepie",
		fractional: () => "paisa",
	},
	pt: {
		main: (count) => (count === 1 ? "rupia" : "rupias"),
		fractional: (count) => (count === 1 ? "paisa" : "paise"),
	},
	ja: {
		main: () => "ルピー",
		fractional: () => "パイサ",
	},
	zh: {
		main: () => "卢比",
		fractional: () => "派萨",
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
		fractional: () => "пайса",
	},
	id: {
		main: () => "rupee",
		fractional: () => "paisa",
	},
};
