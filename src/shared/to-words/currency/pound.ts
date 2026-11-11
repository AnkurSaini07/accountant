import type { CurrencyUnit } from "../types";

export const pound: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "pound" : "pounds"),
		fractional: (count) => (count === 1 ? "penny" : "pence"),
	},
	de: {
		main: () => "Pfund",
		fractional: () => "Penny",
	},
	fr: {
		main: (count) => (count === 1 ? "livre" : "livres"),
		fractional: (count) => (count === 1 ? "penny" : "pence"),
	},
	es: {
		main: (count) => (count === 1 ? "libra" : "libras"),
		fractional: (count) => (count === 1 ? "penique" : "peniques"),
	},
	it: {
		main: (count) => (count === 1 ? "sterlina" : "sterline"),
		fractional: (count) => (count === 1 ? "penny" : "pence"),
	},
	nl: {
		main: () => "pond",
		fractional: () => "penny",
	},
	pt: {
		main: (count) => (count === 1 ? "libra" : "libras"),
		fractional: (count) => (count === 1 ? "penny" : "pence"),
	},
	hi: {
		main: () => "पाउंड",
		fractional: () => "पेनी",
	},
	ja: {
		main: () => "ポンド",
		fractional: () => "ペンス",
	},
	zh: {
		main: () => "英镑",
		fractional: () => "便士",
	},
	ru: {
		main: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "фунт";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "фунта";
			}
			return "фунтов";
		},
		fractional: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "пенни";
			}
			return "пенни"; // In Russian, penny is often treated as invariant or just 'penny'
		},
	},
	id: {
		main: () => "pound",
		fractional: () => "penny",
	},
};
