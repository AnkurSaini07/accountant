import { ToWords } from "./to-words";

export function getSupportedSystem(language: string) {
	const toWords = new ToWords({
		locale: language,
	});
	return toWords.getSupportedSystems();
}

export function getDefaultNumberSystem(language: string) {
	const toWords = new ToWords({
		locale: language,
	});
	return toWords.getDefaultSystemId();
}
