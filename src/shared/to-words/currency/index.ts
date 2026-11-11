import type { CurrencyUnit } from "../types";
import { dollar } from "./dollar";
import { euro } from "./euro";
import { franc } from "./franc";
import { lira } from "./lira";
import { peso } from "./peso";
import { pound } from "./pound";
import { real } from "./real";
import { ruble } from "./ruble";
import { rupee } from "./rupee";
import { rupiah } from "./rupiah";
import { won } from "./won";
import { yen } from "./yen";
import { yuan } from "./yuan";

export const currencyMap: Record<string, CurrencyUnit> = {
	USD: dollar,
	EUR: euro,
	GBP: pound,
	INR: rupee,
	JPY: yen,
	RUB: ruble,
	CNY: yuan,
	IDR: rupiah,
	BRL: real,
	AUD: dollar,
	CAD: dollar,
	NZD: dollar,
	SGD: dollar,
	HKD: dollar,
	PKR: rupee,
	LKR: rupee,
	NPR: rupee,
	EGP: pound,
	LBP: pound,
	SDG: pound,
	TRY: lira,
	MXN: peso,
	ARS: peso,
	COP: peso,
	CLP: peso,
	PHP: peso,
	CHF: franc,
	KRW: won,
};
