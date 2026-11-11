import Archive from "@react-spectrum/s2/icons/Archive";
import Briefcase from "@react-spectrum/s2/icons/Briefcase";
import ChartBarVert from "@react-spectrum/s2/icons/ChartBarVert";
import FileText from "@react-spectrum/s2/icons/FileText";
import Home from "@react-spectrum/s2/icons/Home";
import Settings from "@react-spectrum/s2/icons/Settings";
import ShoppingCart from "@react-spectrum/s2/icons/ShoppingCart";
import UserGroup from "@react-spectrum/s2/icons/UserGroup";
import Wallet from "@react-spectrum/s2/icons/Wallet";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { Link } from "@react-spectrum/s2/Link";
import { useAtomValue } from "jotai";
import type { ComponentType, ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { parseFyLabel } from "../shared/fy.ts";
import { CompanySettings } from "./pages/settings/Company.tsx";
import { Numbering } from "./pages/settings/Numbering.tsx";
import { PartyList } from "./pages/parties/PartyList.tsx";
import { financialYearAtom } from "./state.ts";

export type NavSection = { path: string; label: string; icon: ComponentType };

// One entry per top-level area. Feature tasks replace each placeholder with real pages under its path.
export const NAV: NavSection[] = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/sales", label: "Sales", icon: FileText },
  { path: "/purchase", label: "Purchase", icon: ShoppingCart },
  { path: "/accounts", label: "Accounts", icon: Wallet },
  { path: "/inventory", label: "Inventory", icon: Archive },
  { path: "/reports", label: "Reports", icon: ChartBarVert },
  { path: "/payroll", label: "Payroll", icon: Briefcase },
  { path: "/masters", label: "Masters", icon: UserGroup },
  { path: "/settings", label: "Settings", icon: Settings },
];

/** The nav section a path belongs to, e.g. "/sales/invoices/42" → "/sales". */
export function sectionOf(pathname: string): string {
  const first = pathname.split("/")[1] ?? "";
  return NAV.some((s) => s.path === `/${first}`) ? `/${first}` : "/";
}

const pageTitle = style({ font: "heading-lg", margin: 0 });
const pageBody = style({ font: "body", color: "gray-700" });

function Placeholder({ label }: { label: string }) {
  return (
    <>
      <h1 className={pageTitle}>{label}</h1>
      <p className={pageBody}>Coming soon.</p>
    </>
  );
}

function NotFound() {
  return (
    <>
      <h1 className={pageTitle}>Page not found</h1>
      <p className={pageBody}>Use the navigation to find what you were looking for.</p>
    </>
  );
}

const settingsNav = style({ display: "flex", gap: 16, marginBottom: 16, font: "ui" });
const SETTINGS = [
  { path: "/settings/company", label: "Company" },
  { path: "/settings/numbering", label: "Numbering" },
];

/** Settings pages share a small tab-like nav. */
function SettingsPage({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <>
      <nav aria-label="Settings" className={settingsNav}>
        {SETTINGS.map(({ path, label }) => (
          <Link key={path} href={path} isStandalone isQuiet={pathname !== path} aria-current={pathname === path ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}

export function AppRoutes() {
  const financialYear = useAtomValue(financialYearAtom); // the header's FY label, e.g. "2026-27"
  return (
    <Routes>
      <Route path="/masters" element={<Navigate replace to="/masters/parties" />} />
      <Route path="/masters/parties" element={<PartyList />} />
      <Route path="/settings" element={<Navigate replace to="/settings/company" />} />
      <Route path="/settings/company" element={<SettingsPage><CompanySettings /></SettingsPage>} />
      <Route path="/settings/numbering" element={<SettingsPage><Numbering fy={parseFyLabel(financialYear)} /></SettingsPage>} />
      {NAV.filter(({ path }) => path !== "/settings").map(({ path, label }) => (
        <Route key={path} path={path === "/" ? "/" : `${path}/*`} element={<Placeholder label={label} />} />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
