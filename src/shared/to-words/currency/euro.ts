import type { CurrencyUnit } from "../types";

export const euro: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "euro" : "euros"),
		fractional: (count) => (count === 1 ? "cent" : "cents"),
	},
	de: {
		main: () => "Euro",
		fractional: () => "Cent",
	},
	fr: {
		main: (count) => (count === 1 ? "euro" : "euros"),
		fractional: (count) => (count === 1 ? "centime" : "centimes"),
	},
	es: {
		main: (count) => (count === 1 ? "euro" : "euros"),
		fractional: (count) => (count === 1 ? "céntimo" : "céntimos"),
	},
	it: {
		main: () => "euro",
		fractional: (count) => (count === 1 ? "centesimo" : "centesimi"),
	},
	nl: {
		main: () => "euro",
		fractional: (count) => (count === 1 ? "cent" : "cent"),
	},
	pt: {
		main: (count) => (count === 1 ? "euro" : "euros"),
		fractional: (count) => (count === 1 ? "cêntimo" : "cêntimos"),
	},
	"pt-PT": {
		main: (count) => (count === 1 ? "euro" : "euros"),
		fractional: (count) => (count === 1 ? "cêntimo" : "cêntimos"),
	},
	hi: {
		main: () => "यूरो",
		fractional: () => "सेंट",
	},
	ja: {
		main: () => "ユーロ",
		fractional: () => "セント",
	},
	zh: {
		main: () => "欧元",
		fractional: () => "欧分",
	},
	ru: {
		main: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "евро";
			}
			return "евро";
		},
		fractional: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "цент";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "цента";
			}
			return "центов";
		},
	},
	id: {
		main: () => "euro",
		fractional: () => "sen",
	},
};
