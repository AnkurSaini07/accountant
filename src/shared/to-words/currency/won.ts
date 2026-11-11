import type { CurrencyUnit } from "../types";

export const won: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "won" : "won"),
		fractional: (count) => (count === 1 ? "jeon" : "jeon"),
	},
	ko: {
		main: () => "원",
		fractional: () => "전",
	},
	hi: {
		main: () => "वॉन",
		fractional: () => "जियोन",
	},
	de: { main: () => "Won", fractional: () => "Jeon" },
	fr: { main: () => "won", fractional: () => "jeon" },
	es: { main: () => "won", fractional: () => "jeon" },
	it: { main: () => "won", fractional: () => "jeon" },
	nl: { main: () => "won", fractional: () => "jeon" },
	pt: { main: () => "won", fractional: () => "jeon" },
	ja: { main: () => "ウォン", fractional: () => "チョン" },
	zh: { main: () => "韩元", fractional: () => "钱" },
	id: { main: () => "won", fractional: () => "jeon" },
	ru: {
		main: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "вон";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "воны";
			}
			return "вон";
		},
		fractional: () => "чон",
	},
};
