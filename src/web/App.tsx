// Import S2 components from their own entry points, not "@react-spectrum/s2": the main index pulls in
// every component's CSS (783 KB vs 145 KB minified for one page). See docs/adr/0001-ui-library.md.
import { Provider } from "@react-spectrum/s2/Provider";
import { ToastContainer } from "@react-spectrum/s2/Toast";
import { useState } from "react";
import { BrowserRouter, Route, Routes, useHref, useNavigate } from "react-router";
import { fyLabel, recentFys } from "../shared/fy.ts";
import { AuthProvider, RequireAuth, useAuth, useUser } from "./auth.tsx";
import { Layout } from "./components/Layout.tsx";
import { NoAccess, SignIn } from "./pages/SignIn.tsx";
import { AppRoutes } from "./routes.tsx";

// ponytail: placeholder until the company profile API (#22) exists.
const COMPANY_NAME = "My Company";

/** The app for a signed-in user: layout + section routes. */
function SignedInApp() {
  const user = useUser();
  const { signOut } = useAuth();
  const financialYears = recentFys(3).map(fyLabel);
  const [financialYear, setFinancialYear] = useState(financialYears[0]!);
  return (
    <Layout
      companyName={COMPANY_NAME}
      financialYears={financialYears}
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
