import type { SystemUnit } from "../types";

const hi: Array<SystemUnit> = [
	{ place: 1e2, value: "सौ" },
	{ place: 1e3, value: "हज़ार" },
	{ place: 1e5, value: "लाख" },
	{ place: 1e7, value: "करोड़" },
	{ place: 1e9, value: "अरब" },
	{ place: 1e11, value: "खरब" },
];

const en: Array<SystemUnit> = [
	{ place: 1e2, value: "hundred" },
	{ place: 1e3, value: "thousand" },
	{ place: 1e5, value: "lakh" },
	{ place: 1e7, value: "crore" },
	{ place: 1e9, value: "arab" },
	{ place: 1e11, value: "kharab" },
];

export const indianConfig = {
	hi: { id: "hi (Indian)", units: hi, locale: "hi" },
	en: { id: "en (Indian)", units: en, locale: "en" },
};
