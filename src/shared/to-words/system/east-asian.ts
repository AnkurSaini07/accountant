import type { SystemUnit } from "../types";

const zh: Array<SystemUnit> = [
	{ place: 1e2, value: "佰" },
	{ place: 1e3, value: "仟" },
	{ place: 1e4, value: "萬" },
	{ place: 1e8, value: "億" },
	{ place: 1e12, value: "兆" },
	{ place: 1e15, value: "京" },
];

const ja: Array<SystemUnit> = [
	{ place: 1e2, value: "百" },
	{ place: 1e3, value: "千" },
	{ place: 1e4, value: "萬" },
	{ place: 1e8, value: "億" },
	{ place: 1e12, value: "兆" },
	{ place: 1e15, value: "京" },
];

export const eastAsianConfig = {
	zh: { id: "zh (East Asian)", units: zh, locale: "zh" },
	ja: { id: "ja (East Asian)", units: ja, locale: "ja" },
};
