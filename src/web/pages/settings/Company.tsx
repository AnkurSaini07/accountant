// Settings → Company (FR-1.1): the profile printed on every document. Admins edit; everyone else
// reads. CompanyLoader loads it once for the whole app; CompanyForm is the form.
import { Spinner } from "@primer/react";
import { useAtom } from "jotai";
import { companyAtom } from "../../state.ts";
import type { Company } from "./company.ts";
import { CompanyForm } from "./CompanyForm.tsx";

/** Name for the header: trade name if set, else the legal name. */
export const displayName = (c: Company | null) => c?.trade_name || c?.legal_name || "";

export function CompanySettings() {
  const [company, setCompany] = useAtom(companyAtom);
  if (!company) return <Spinner srText="Loading" />;
  // key: a save replaces the company (new ids), so the form starts from the saved data again.
  return <CompanyForm key={JSON.stringify(company)} company={company} onSaved={setCompany} />;
}
