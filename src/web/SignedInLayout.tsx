import { useAtom, useAtomValue } from "jotai";
import { useAuth, useUser } from "./auth.tsx";
import { Layout } from "./components/Layout.tsx";
import { displayName } from "./pages/settings/Company.tsx";
import { AppRoutes } from "./AppRoutes.tsx";
import { companyAtom, FINANCIAL_YEARS, financialYearAtom } from "./state.ts";

export function SignedInLayout() {
  const user = useUser();
  const company = useAtomValue(companyAtom);
  const { signOut } = useAuth();
  const [financialYear, setFinancialYear] = useAtom(financialYearAtom);
  return (
    <Layout
      companyName={displayName(company)}
      financialYears={FINANCIAL_YEARS}
      financialYear={financialYear}
      onFinancialYearChange={setFinancialYear}
      user={user}
      onSignOut={() => void signOut()}>
      <AppRoutes />
    </Layout>
  );
}
