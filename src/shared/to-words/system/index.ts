import { eastAsianConfig } from "./east-asian";
import { indianConfig } from "./indian";
import { internationalConfig } from "./international";
import type { SystemConfig } from "../types";

const localeSystemMap: Record<string, Array<SystemConfig>> = {};

[eastAsianConfig, indianConfig, internationalConfig].forEach((config) => {
	Object.values(config).forEach((systemConfig) => {
		(localeSystemMap[systemConfig.locale] ??= []).push(systemConfig);
	});
});

Object.freeze(localeSystemMap);

export { localeSystemMap, eastAsianConfig, indianConfig, internationalConfig };
