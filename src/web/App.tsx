// Import S2 components from their own entry points, not "@react-spectrum/s2": the main index pulls in
// every component's CSS (783 KB vs 145 KB minified for one page). See docs/adr/0001-ui-library.md.
import { Provider } from "@react-spectrum/s2/Provider";
import { useState } from "react";
import { BrowserRouter, useHref, useNavigate } from "react-router";
import { Layout } from "./components/Layout.tsx";
import { AppRoutes } from "./routes.tsx";

// ponytail: placeholder until the company profile API (#22) and FY utils (#11) exist.
const COMPANY_NAME = "My Company";
function recentFinancialYears(today = new Date(), count = 3): string[] {
  const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1; // FY starts 1 April
  return Array.from({ length: count }, (_, i) => {
    const y = startYear - i;
    return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  });
}

/** Everything below the router; tests render this inside a MemoryRouter. */
export function Shell() {
  const navigate = useNavigate();
  const financialYears = recentFinancialYears();
  const [financialYear, setFinancialYear] = useState(financialYears[0]!);

  return (
    // `router` makes S2 links (e.g. SideNav) navigate client-side instead of reloading the page.
    <Provider background="base" router={{ navigate, useHref }}>
      <Layout
        companyName={COMPANY_NAME}
        financialYears={financialYears}
        financialYear={financialYear}
        onFinancialYearChange={setFinancialYear}>
        <AppRoutes />
      </Layout>
    </Provider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
