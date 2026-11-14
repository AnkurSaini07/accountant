// App-wide UI state (Jotai atoms). Shell wraps the app in a Jotai <Provider>, so each mount (and
// each test render) gets a fresh store. Screen-local state stays in useState.
import { atom } from "jotai";
import { fyLabel, recentFys } from "../shared/fy.ts";
import type { Company } from "./pages/settings/company.ts";

/** The financial years the header offers, newest first, e.g. "2026-27". */
export const FINANCIAL_YEARS = recentFys(3).map(fyLabel);
/** The FY picked in the header. Resets to the current FY on reload. */
export const financialYearAtom = atom(FINANCIAL_YEARS[0]!);
/** The company profile: loaded once after sign-in (CompanyLoader), replaced when Settings saves it. */
export const companyAtom = atom<Company | null>(null);
