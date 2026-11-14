import { Provider as StateProvider } from "jotai";
import { Route, Routes } from "react-router";
import { AuthProvider } from "./auth.tsx";
import { RequireAuth } from "./RequireAuth.tsx";
import { SignIn } from "./pages/SignIn.tsx";
import { NoAccess } from "./pages/NoAccess.tsx";
import { SignedInApp } from "./SignedInApp.tsx";
import { Toasts } from "./components/Toasts.tsx";
import { useAppLinks } from "./useAppLinks.ts";

/** Everything below the router and the theme; tests render this inside a MemoryRouter. */
export function Shell() {
  useAppLinks(); // Primer links are plain <a href>: route same-app clicks client-side
  return (
    <>
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
      {/* Shows api.ts failure toasts and save confirmations. */}
      <Toasts />
    </>
  );
}
