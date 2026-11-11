import type { SystemUnit } from "../types";

const fr: Array<SystemUnit> = [
	{ place: 1e2, value: "cent" },
	{ place: 1e3, value: "mille" },
	{
		place: 1e6,
		value: (count) => (count === 1 ? "million" : "millions"),
	},
	{
		place: 1e9,
		value: (count) => (count === 1 ? "milliard" : "milliards"),
	},
	{
		place: 1e12,
		value: (count) => (count === 1 ? "billion" : "billions"),
	},
	{
		place: 1e15,
		value: (count) => (count === 1 ? "billiard" : "billiards"),
	},
];

const de: Array<SystemUnit> = [
	{ place: 1e2, value: "hundert" },
	{ place: 1e3, value: "tausend" }, // Invariant
	{
		place: 1e6,
		value: (count) => (count === 1 ? "Million" : "Millionen"),
	},
	{
		place: 1e9,
		value: (count) => (count === 1 ? "Milliarde" : "Milliarden"),
	},
	{
		place: 1e12,
		value: (count) => (count === 1 ? "Billion" : "Billionen"),
	},
	{
		place: 1e15,
		value: (count) => (count === 1 ? "Billiarde" : "Billiarden"),
	},
];

const es: Array<SystemUnit> = [
	{ place: 1e2, value: "cien" },
	{ place: 1e3, value: "mil" }, // Invariant
	{
		place: 1e6,
		value: (count) => (count === 1 ? "millón" : "millones"),
	},
	{
		place: 1e9,
		value: (count) => (count === 1 ? "millardo" : "millardos"),
	},
	{
		place: 1e12,
		value: (count) => (count === 1 ? "billón" : "billones"),
	},
	{
		place: 1e15,
		value: (count) => (count === 1 ? "billardo" : "billardos"),
	},
];

const pt_PT: Array<SystemUnit> = [
	{ place: 1e2, value: "cem" },
	{ place: 1e3, value: "mil" }, // Invariant
	{
		place: 1e6,
		value: (count) => (count === 1 ? "milhão" : "milhões"),
	},
	{
		place: 1e9,
		value: (count) => (count === 1 ? "milhar de milhão" : "milhares de milhão"),
	},
	{
		place: 1e12,
		value: (count) => (count === 1 ? "bilião" : "biliões"),
	},
	{
		place: 1e15,
		value: (count) => (count === 1 ? "biliardo" : "biliardos"),
	},
];

const pt: Array<SystemUnit> = [
	{ place: 1e2, value: "cem" },
	{ place: 1e3, value: "mil" },
	{ place: 1e6, value: (count) => (count === 1 ? "milhão" : "milhões") },
	{ place: 1e9, value: (count) => (count === 1 ? "bilhão" : "bilhões") },
	{ place: 1e12, value: (count) => (count === 1 ? "trilhão" : "trilhões") },
	{
		place: 1e15,
		value: (count) => (count === 1 ? "quatrilhão" : "quatrilhões"),
	},
];

const it: Array<SystemUnit> = [
	{ place: 1e2, value: "cento" }, // Invariant
	{ place: 1e3, value: "mille" }, // Plural is 'mila' (e.g., duemila), requires special logic
	{
		place: 1e6,
		value: (count) => (count === 1 ? "milione" : "milioni"),
	},
	{
		place: 1e9,
		value: (count) => (count === 1 ? "miliardo" : "miliardi"),
	},
	{
		place: 1e12,
		value: (count) => (count === 1 ? "bilione" : "bilioni"),
	},
	{
		place: 1e15,
		value: (count) => (count === 1 ? "biliardo" : "biliardi"),
	},
];

const nl: Array<SystemUnit> = [
	{ place: 1e2, value: "honderd" }, // Invariant
	{ place: 1e3, value: "duizend" }, // Invariant
	{
		place: 1e6,
		value: (count) => (count === 1 ? "miljoen" : "miljoenen"),
	},
	{
		place: 1e9,
		value: (count) => (count === 1 ? "miljard" : "miljarden"),
	},
	{
		place: 1e12,
		value: (count) => (count === 1 ? "biljoen" : "biljoenen"),
	},
	{
		place: 1e15,
		value: (count) => (count === 1 ? "biljard" : "biljarden"),
	},
];

const en: Array<SystemUnit> = [
	{ place: 1e2, value: "hundred" },
	{ place: 1e3, value: "thousand" },
	{ place: 1e6, value: "million" },
	{ place: 1e9, value: "billion" },
	{ place: 1e12, value: "trillion" },
	{ place: 1e15, value: "quadrillion" },
];

const hi: Array<SystemUnit> = [
	{ place: 1e2, value: "सौ" },
	{ place: 1e3, value: "हज़ार" },
	{ place: 1e6, value: "मिलियन" },
	{ place: 1e9, value: "बिलियन" },
	{ place: 1e12, value: "ट्रिलियन" },
	{ place: 1e15, value: "क्वाड्रिलियन" },
];

const ru: Array<SystemUnit> = [
	{ place: 1e2, value: "Сто" },
	{ place: 1e3, value: (count) => (count === 1 ? "Тысяча" : "Тысяч") },
	{ place: 1e6, value: (count) => (count === 1 ? "Миллион" : "Миллиона") },
	{ place: 1e9, value: (count) => (count === 1 ? "Миллиард" : "Миллиарда") },
	{ place: 1e12, value: (count) => (count === 1 ? "Триллион" : "Триллиона") },
	{
		place: 1e15,
		value: (count) => (count === 1 ? "Квадриллион" : "Квадриллиона"),
	},
];

const id: Array<SystemUnit> = [
	{ place: 1e2, value: "ratus" },
	{ place: 1e3, value: "ribu" },
	{ place: 1e6, value: "juta" },
	{ place: 1e9, value: "miliar" },
	{ place: 1e12, value: "triliun" },
	{ place: 1e15, value: "kuadriliun" },
];

export const internationalConfig = {
	nl: { id: "nl (International)", units: nl, locale: "nl" },
	it: { id: "it (International)", units: it, locale: "it" },
	pt: { id: "pt (International)", units: pt, locale: "pt" },
	es: { id: "es (International)", units: es, locale: "es" },
	de: { id: "de (International)", units: de, locale: "de" },
	fr: { id: "fr (International)", units: fr, locale: "fr" },
	en: { id: "en (International)", units: en, locale: "en" },
	pt_PT: { id: "pt-PT (International)", units: pt_PT, locale: "pt-PT" },
	ru: { id: "ru (International)", units: ru, locale: "ru" },
	id: { id: "id (International)", units: id, locale: "id" },
	hi: { id: "hi (International)", units: hi, locale: "hi" },
};
