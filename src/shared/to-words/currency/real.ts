import type { CurrencyUnit } from "../types";

export const real: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "real" : "reals"),
		fractional: (count) => (count === 1 ? "centavo" : "centavos"),
	},
	pt: {
		main: (count) => (count === 1 ? "real" : "reais"),
		fractional: (count) => (count === 1 ? "centavo" : "centavos"),
	},
	es: {
		main: (count) => (count === 1 ? "real" : "reales"),
		fractional: (count) => (count === 1 ? "centavo" : "centavos"),
	},
	fr: {
		main: (count) => (count === 1 ? "réal" : "réals"),
		fractional: (count) => (count === 1 ? "centavo" : "centavos"),
	},
	it: {
		main: (count) => (count === 1 ? "real" : "real"),
		fractional: (count) => (count === 1 ? "centavo" : "centavos"),
	},
	de: {
		main: () => "Real",
		fractional: () => "Centavo",
	},
	nl: {
		main: () => "real",
		fractional: () => "centavo",
	},
	hi: {
		main: () => "रियाल",
		fractional: () => "सेंटावो",
	},
	ja: {
		main: () => "レアル",
		fractional: () => "センターボ",
	},
	zh: {
		main: () => "雷亚尔",
		fractional: () => "仙",
	},
	ru: {
		main: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "реал";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "реала";
			}
			return "реалов";
		},
		fractional: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "сентаво";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "сентаво";
			}
			return "сентаво";
		},
	},
	id: {
		main: () => "real",
		fractional: () => "centavo",
	},
};
