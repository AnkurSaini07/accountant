import type { CurrencyUnit } from "../types";

export const dollar: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "dollar" : "dollars"),
		fractional: (count) => (count === 1 ? "cent" : "cents"),
	},
	hi: {
		main: () => "डॉलर",
		fractional: () => "सेंट",
	},
	de: {
		main: (count) => (count === 1 ? "Dollar" : "Dollar"),
		fractional: (count) => (count === 1 ? "Cent" : "Cent"),
	},
	es: {
		main: (count) => (count === 1 ? "dólar" : "dólares"),
		fractional: (count) => (count === 1 ? "centavo" : "centavos"),
	},
	fr: {
		main: (count) => (count === 1 ? "dollar" : "dollars"),
		fractional: (count) => (count === 1 ? "cent" : "cents"),
	},
	id: {
		main: () => "dolar",
		fractional: () => "sen",
	},
	it: {
		main: (count) => (count === 1 ? "dollaro" : "dollari"),
		fractional: (count) => (count === 1 ? "centesimo" : "centesimi"),
	},
	ja: {
		main: () => "ドル",
		fractional: () => "セント",
	},
	nl: {
		main: () => "dollar", // Dutch often uses singular for currency after amount
		fractional: () => "cent",
	},
	pt: {
		main: (count) => (count === 1 ? "dólar" : "dólares"),
		fractional: (count) => (count === 1 ? "centavo" : "centavos"),
	},
	ru: {
		main: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "доллар";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "доллара";
			}
			return "долларов";
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
	zh: {
		main: () => "美元",
		fractional: () => "美分",
	},
};
