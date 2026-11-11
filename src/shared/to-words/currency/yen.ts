import type { CurrencyUnit } from "../types";

export const yen: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "yen" : "yen"),
		fractional: (count) => (count === 1 ? "sen" : "sen"),
	},
	ja: {
		main: () => "円",
		fractional: () => "銭",
	},
	hi: {
		main: () => "येन",
		fractional: () => "सेन",
	},
	de: {
		main: () => "Yen",
		fractional: () => "Sen",
	},
	fr: {
		main: () => "yen",
		fractional: () => "sen",
	},
	es: {
		main: () => "yen",
		fractional: () => "sen",
	},
	it: {
		main: () => "yen",
		fractional: () => "sen",
	},
	nl: {
		main: () => "yen",
		fractional: () => "sen",
	},
	pt: {
		main: () => "iene",
		fractional: () => "sen",
	},
	zh: {
		main: () => "日元",
		fractional: () => "钱",
	},
	ru: {
		// Yen is usually indeclinable in speech or treated as male plural genitive 'иен'
		main: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "иена";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "иены";
			}
			return "иен";
		},
		fractional: () => "сен",
	},
	id: {
		main: () => "yen",
		fractional: () => "sen",
	},
};
