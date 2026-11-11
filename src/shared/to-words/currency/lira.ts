import type { CurrencyUnit } from "../types";

export const lira: CurrencyUnit = {
	en: {
		main: (count) => (count === 1 ? "lira" : "lira"),
		fractional: (count) => (count === 1 ? "kurus" : "kurus"),
	},
	tr: {
		main: () => "lira",
		fractional: () => "kuruş",
	},
	hi: {
		main: () => "लीरा",
		fractional: () => "कुरु्श",
	},
	// Defaults for others
	de: { main: () => "Lira", fractional: () => "Kurus" },
	fr: { main: () => "lira", fractional: () => "kurus" },
	es: { main: () => "lira", fractional: () => "kurus" },
	it: { main: () => "lira", fractional: () => "kurus" },
	nl: { main: () => "lira", fractional: () => "kurus" },
	pt: { main: () => "lira", fractional: () => "kurus" },
	ja: { main: () => "リラ", fractional: () => "クルシュ" },
	zh: { main: () => "里拉", fractional: () => "库鲁" },
	id: { main: () => "lira", fractional: () => "kurus" },
	ru: {
		main: (count) => {
			const mod10 = (count || 0) % 10;
			const mod100 = (count || 0) % 100;
			if (mod10 === 1 && mod100 !== 11) {
				return "лира";
			}
			if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
				return "лиры";
			}
			return "лир";
		},
		fractional: () => "куруш",
	},
};
