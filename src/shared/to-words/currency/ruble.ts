import type { CurrencyUnit } from "../types";

export const ruble: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "ruble" : "rubles"),
		fractional: (count) => (count === 1 ? "kopek" : "kopeks"),
	},
	ru: {
		main: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "рубль";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "рубля";
			}
			return "рублей";
		},
		fractional: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "копейка";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "копейки";
			}
			return "копеек";
		},
	},
	de: {
		main: () => "Rubel",
		fractional: () => "Kopeke",
	},
	fr: {
		main: (count) => (count === 1 ? "rouble" : "roubles"),
		fractional: (count) => (count === 1 ? "kopeck" : "kopecks"),
	},
	es: {
		main: (count) => (count === 1 ? "rublo" : "rublos"),
		fractional: (count) => (count === 1 ? "kopek" : "kopeks"),
	},
	it: {
		main: (count) => (count === 1 ? "rublo" : "rubli"),
		fractional: (count) => (count === 1 ? "copeco" : "copechi"),
	},
	nl: {
		main: () => "roebel",
		fractional: (count) => (count === 1 ? "kopeke" : "kopeken"),
	},
	pt: {
		main: (count) => (count === 1 ? "rublo" : "rublos"),
		fractional: (count) => (count === 1 ? "copeque" : "copeques"),
	},
	hi: {
		main: () => "रूबल",
		fractional: () => "कोपेक",
	},
	ja: {
		main: () => "ルーブル",
		fractional: () => "カペイカ",
	},
	zh: {
		main: () => "卢布",
		fractional: () => "戈比",
	},
	id: {
		main: () => "rubel",
		fractional: () => "kopek",
	},
};
