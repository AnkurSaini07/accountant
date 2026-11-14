import { Route, Routes } from "react-router";
import { CompanyLoader } from "./pages/settings/CompanyLoader.tsx";
import { PrintRoutes } from "./PrintRoutes.tsx";
import { SignedInLayout } from "./SignedInLayout.tsx";

/** The app for a signed-in user: layout + section routes. */
export function SignedInApp() {
  return (
    <CompanyLoader>
      <Routes>
        <Route path="/print/*" element={<PrintRoutes />} />
        <Route path="*" element={<SignedInLayout />} />
      </Routes>
    </CompanyLoader>
  );
}
