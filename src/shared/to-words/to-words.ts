import {
	countryCurrencyMap,
	countrySystemMap,
} from "./country-map";
import type { SystemConfig } from "./types";
import { currencyMap } from "./currency";
import { internationalConfig, localeSystemMap } from "./system";
import { translationMap } from "./translations";

interface ToWordsOptions {
	locale: string;
}

interface ConvertOptions {
	systemId?: string;
	currency?: string;
	doNotAddOnly?: boolean;
}

export class ToWords {
	private readonly options: ToWordsOptions;
	private readonly defaultSystemId: string;
	private readonly supportedSystems: Array<string>;
	private readonly localeSystemConfigs: Array<SystemConfig>;

	constructor(options: ToWordsOptions) {
		this.options = options;
		const [language = "", country = ""] = options.locale.split("-");
		const localeSystemConfigs =
			localeSystemMap[options.locale] || localeSystemMap[language] || [];
		this.localeSystemConfigs = localeSystemConfigs;
		this.supportedSystems = localeSystemConfigs.map((system) => system.id);

		if (this.supportedSystems.length === 0) {
			this.defaultSystemId = internationalConfig.en.id;
		} else if (this.supportedSystems.length === 1) {
			this.defaultSystemId = this.supportedSystems[0]!;
		} else {
			const countrySystemId =
				countrySystemMap[options.locale]?.id || countrySystemMap[country]?.id;
			if (countrySystemId && this.supportedSystems.includes(countrySystemId)) {
				this.defaultSystemId = countrySystemId;
			} else {
				// Fallback: Prefer International system for the language, otherwise first available
				const internationalSystem = localeSystemConfigs.find((system) =>
					system.id.includes("International"),
				);
				this.defaultSystemId = internationalSystem
					? internationalSystem.id
					: this.supportedSystems[0]!;
			}
		}
	}

	getSupportedSystems(): Array<string> {
		return this.supportedSystems;
	}

	getDefaultSystemId(): string {
		return this.defaultSystemId;
	}

	private getConfigs(options?: ConvertOptions) {
		const [language = "", country = ""] = this.options.locale.split("-");
		const systemConfig =
			(options?.systemId
				? this.localeSystemConfigs.find(
						(system) => system.id === options?.systemId,
					)
				: this.localeSystemConfigs.find(
						(system) => system.id === this.defaultSystemId,
					)) || internationalConfig.en;

		if (!systemConfig) {
			throw new Error(`No system found for language ${language} in ${country}`);
		}

		// Use the language defined in the system for translation, fallback to locale language
		const targetLanguage = systemConfig.locale;
		const translation =
			translationMap[targetLanguage as keyof typeof translationMap];

		if (!translation) {
			throw new Error(`Translation for ${targetLanguage} not supported`);
		}
		const currencyCode = options?.currency || countryCurrencyMap[country];
		return {
			translation,
			systemConfig,
			targetLanguage,
			currencyCode,
		};
	}

	numberToWords(input: number, options?: ConvertOptions): string {
		const { translation, systemConfig } = this.getConfigs(options);

		const processNumber = (num: number): string => {
			if (num === 0) return "";

			// Handle numbers defined in translation (0-19, 20, 30, ... 90)
			if (translation.numbers[num]) {
				return translation.numbers[num];
			}

			// Handle regular tens (21-99) by combining tens and ones
			if (num < 100) {
				const tens = Math.floor(num / 10) * 10;
				const ones = num % 10;
				if (translation.numbers[tens] && ones > 0) {
					return `${translation.numbers[tens]} ${translation.numbers[ones]}`;
				}
			}

			// Iterate over system units in descending order
			const sortedUnits = [...systemConfig.units].sort(
				(a, b) => b.place - a.place,
			);

			for (const unit of sortedUnits) {
				if (num >= unit.place) {
					const quotient = Math.floor(num / unit.place);
					const remainder = num % unit.place;

					let str = "";

					// We will recurse for the quotient.
					str += processNumber(quotient);

					const unitValue =
						typeof unit.value === "function"
							? unit.value(quotient)
							: unit.value;

					str += ` ${unitValue}`;

					if (remainder > 0) {
						str += " ";
						str += processNumber(remainder);
					}

					return str.trim();
				}
			}
			return "";
		};

		if (input === 0) {
			return translation.numbers[0]!;
		}

		const isNegative = input < 0;
		const absInput = Math.abs(input);
		const parts = absInput.toString().split(".");
		const integerPart = parseInt(parts[0]!, 10);

		let words = "";
		if (isNegative) {
			words += `${translation.texts.minus} `;
		}

		if (integerPart === 0) {
			words += translation.numbers[0];
		} else {
			words += processNumber(integerPart);
		}

		if (parts.length > 1) {
			words += ` ${translation.texts.point}`;
			const decimalStr = parts[1]!;
			const match = decimalStr.match(/^(0*)(.*)$/);
			if (match) {
				const zeros = match[1]!;
				const rest = match[2];
				for (const _ of zeros) {
					words += ` ${translation.numbers[0]}`;
				}
				if (rest) {
					words += ` ${processNumber(parseInt(rest, 10))}`;
				}
			}
		}

		return words.trim();
	}

	numberToCurrency(input: number, options?: ConvertOptions): string {
		const { translation, targetLanguage, currencyCode } =
			this.getConfigs(options);

		if (!currencyCode) {
			return "";
		}

		const currency = currencyMap[currencyCode];
		if (!currency) {
			return "";
		}

		const currencyLanguageStr = currency[targetLanguage];
		if (!currencyLanguageStr) {
			return "";
		}

		if (input < 0) {
			throw new Error("Money cannot be negative");
		}
		const absInput = Math.abs(input);

		const parts = absInput.toFixed(2).split(".");
		const integerPart = parseInt(parts[0]!, 10);
		const fractionalPart = parseInt(parts[1]!, 10);

		let words = "";

		words += this.numberToWords(integerPart, options);
		words += ` ${currencyLanguageStr.main(integerPart)}`;

		if (fractionalPart > 0) {
			words += ` ${translation.texts.and} `;
			words += this.numberToWords(fractionalPart, options);
			words += ` ${currencyLanguageStr.fractional(fractionalPart)}`;
		} else {
			if (!options?.doNotAddOnly) {
				words += ` ${translation.texts.only}`;
			}
		}

		return words.trim();
	}
}
