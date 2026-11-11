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
import type { ComponentType } from "react";
import { Navigate, Route, Routes } from "react-router";
import { CompanySettings } from "./pages/settings/Company.tsx";

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

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/settings" element={<Navigate replace to="/settings/company" />} />
      <Route path="/settings/company" element={<CompanySettings />} />
      {NAV.filter(({ path }) => path !== "/settings").map(({ path, label }) => (
        <Route key={path} path={path === "/" ? "/" : `${path}/*`} element={<Placeholder label={label} />} />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
