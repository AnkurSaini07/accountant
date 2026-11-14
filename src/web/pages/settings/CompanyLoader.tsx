import { useSetAtom } from "jotai";
import { type ReactNode, useEffect } from "react";
import { call, client } from "../../api.ts";
import { companyAtom } from "../../state.ts";

/** Loads the company into companyAtom once, for everything below it (the header shows its name). */
export function CompanyLoader({ children }: { children: ReactNode }) {
  const setCompany = useSetAtom(companyAtom);
  useEffect(() => {
    call(client.api.company.$get()).then(setCompany, () => {}); // failures toast
  }, [setCompany]);
  return children;
}
