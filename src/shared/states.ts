// Indian states and union territories with their GST state codes (the first two digits of a GSTIN,
// and the "place of supply" code on invoices and e-invoices).
// `utgst`: UTs without a legislature charge CGST + UTGST instead of CGST + SGST on intra-UT supplies.
// `legacy`: codes still found on old GSTINs/documents but not used for new registrations.

export type State = { code: string; name: string; utgst?: true; legacy?: true };

export const STATES: readonly State[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh", utgst: true },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "25", name: "Daman and Diu", utgst: true, legacy: true }, // merged into 26 in 2020
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu", utgst: true },
  { code: "27", name: "Maharashtra" },
  { code: "28", name: "Andhra Pradesh (before division)", legacy: true }, // now 37
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep", utgst: true },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands", utgst: true },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh", utgst: true },
  { code: "97", name: "Other Territory", utgst: true },
];

const BY_CODE = new Map(STATES.map((s) => [s.code, s]));

/** "06" (or 6) → Haryana; undefined for unknown codes. */
export function stateByCode(code: string | number): State | undefined {
  return BY_CODE.get(String(code).padStart(2, "0"));
}
