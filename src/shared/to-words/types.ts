export interface NumberWordConfig {
	texts: {
		point: string;
		minus: string;
		and: string;
		only: string;
	};
	numbers: Record<number, string>; // this is non repeated numbers
}

type UnitValueFn = (count?: number) => string;

export interface SystemUnit {
	place: number;
	value: UnitValueFn | string;
}

export interface SystemConfig {
	id: string;
	locale: string;
	units: Array<SystemUnit>;
}

export interface CurrencyUnit {
	[key: string]: {
		main: UnitValueFn;
		fractional: UnitValueFn;
	};
}
