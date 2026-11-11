// Import S2 components from their own entry points, not "@react-spectrum/s2": the main index pulls in
// every component's CSS (783 KB vs 145 KB minified for one page). See docs/adr/0001-ui-library.md.
import { Provider } from "@react-spectrum/s2/Provider";
import { ToastContainer } from "@react-spectrum/s2/Toast";
import { Provider as StateProvider, useAtom, useAtomValue } from "jotai";
import { BrowserRouter, Route, Routes, useHref, useNavigate } from "react-router";
import { AuthProvider, RequireAuth, useAuth, useUser } from "./auth.tsx";
import { Layout } from "./components/Layout.tsx";
import { CompanyLoader, displayName } from "./pages/settings/Company.tsx";
import { NoAccess, SignIn } from "./pages/SignIn.tsx";
import { AppRoutes, PrintRoutes } from "./routes.tsx";
import { companyAtom, FINANCIAL_YEARS, financialYearAtom } from "./state.ts";


/** The app for a signed-in user: layout + section routes. */
function SignedInApp() {
  return (
    <CompanyLoader>
      <Routes>
        <Route path="/print/*" element={<PrintRoutes />} />
        <Route path="*" element={<SignedInLayout />} />
      </Routes>
    </CompanyLoader>
  );
}

function SignedInLayout() {
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
      userName={user.name}
      onSignOut={() => void signOut()}>
      <AppRoutes />
    </Layout>
  );
}

/** Everything below the router; tests render this inside a MemoryRouter. */
export function Shell() {
  const navigate = useNavigate();
  return (
    // `router` makes S2 links (e.g. SideNav) navigate client-side instead of reloading the page.
    <Provider background="base" router={{ navigate, useHref }}>
      <StateProvider>
        <AuthProvider>
          <Routes>
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/no-access" element={<NoAccess />} />
            <Route
              path="*"
              element={
                <RequireAuth>
                  <SignedInApp />
                </RequireAuth>
              }
            />
          </Routes>
        </AuthProvider>
      </StateProvider>
      {/* Shows api.ts failure toasts. */}
      <ToastContainer placement="bottom" />
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
